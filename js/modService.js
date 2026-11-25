var module = angular.module('modService', ['mapAnalyzeService', 'fileSystemAdapter']);

// A service representing a Mod

module.factory('modService', ['$rootScope', '$timeout', '$modal', '$q', 'mapAnalyzeService', 'pdxScriptService', 'fileSystemAdapter', function($rootScope, $timeout, $modal, $q, mapAnalyzeService, pdxScriptService, fileSystemAdapter) {

	var mapAnalysisTraces = [];
	var nextMapAnalysisTraceId = 0;
	var provinceHistoryReferenceDate = [1444, 11, 11];
	var getProvinceHistoryDate = function (name) {
		var match = /^(\d{1,4})\.(\d{1,2})\.(\d{1,2})$/.exec(name);
		if (!match)
			return null;
		return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
	};
	var compareProvinceHistoryDates = function (a, b) {
		for (var i = 0; i < 3; i++)
		{
			if (a[i] != b[i])
				return a[i] - b[i];
		}
		return 0;
	};
	var getEffectiveProvinceData = function (province) {
		var effectiveData = angular.copy(province.data && province.data.data || {});
		var datedBlocks = [];
		angular.forEach(province.data && province.data.subNodes, function (block, index) {
			var date = getProvinceHistoryDate(block.name);
			if (date && compareProvinceHistoryDates(date, provinceHistoryReferenceDate) <= 0)
				datedBlocks.push({node: block, date: date, index: index});
		});
		datedBlocks.sort(function (a, b) {
			return compareProvinceHistoryDates(a.date, b.date) || a.index - b.index;
		});
		angular.forEach(datedBlocks, function (block) {
			angular.forEach(block.node.subNodes, function (property) {
				effectiveData[property.name] = angular.copy(property.data);
			});
		});
		return effectiveData;
	};

	var logMapAnalysisEvent = function (trace, stage, event, error) {
		var prefix = '[map-analysis '+ trace.id +'] '+ trace.label +' #'+ (++trace.eventNumber) +' '+ stage +': ';
		if (event == 'rejected')
		{
			console.error(prefix + event, error);
			if (!trace.firstRejection)
			{
				trace.firstRejection = {stage: stage, error: error};
				console.error('[map-analysis '+ trace.id +'] FIRST REJECTION at '+ stage, error);
			}
		}
		else
		{
			console.info(prefix + event);
		}
	};

	var traceMapAnalysisPromise = function (stage, operation) {
		var traces = mapAnalysisTraces.slice();
		if (!traces.length)
			return operation();

		angular.forEach(traces, function (trace) {
			logMapAnalysisEvent(trace, stage, 'entry');
		});

		var promise;
		try
		{
			promise = operation();
		}
		catch (error)
		{
			angular.forEach(traces, function (trace) {
				logMapAnalysisEvent(trace, stage, 'rejected', error);
				logMapAnalysisEvent(trace, stage, 'completion');
			});
			return $q.reject(error);
		}

		return $q.when(promise).then(function (result) {
			angular.forEach(traces, function (trace) {
				logMapAnalysisEvent(trace, stage, 'success');
				logMapAnalysisEvent(trace, stage, 'completion');
			});
			return result;
		}, function (error) {
			angular.forEach(traces, function (trace) {
				logMapAnalysisEvent(trace, stage, 'rejected', error);
				logMapAnalysisEvent(trace, stage, 'completion');
			});
			return $q.reject(error);
		});
	};

	var traceMapAnalysis = function (label, operation) {
		var trace = {
			id: ++nextMapAnalysisTraceId,
			label: label,
			eventNumber: 0,
			firstRejection: null
		};
		console.info('[map-analysis '+ trace.id +'] '+ label +': entry');
		mapAnalysisTraces.push(trace);

		var promise;
		try
		{
			promise = operation();
		}
		catch (error)
		{
			logMapAnalysisEvent(trace, 'analysis', 'rejected', error);
			mapAnalysisTraces.splice(mapAnalysisTraces.indexOf(trace), 1);
			logMapAnalysisEvent(trace, 'analysis', 'completion');
			return $q.reject(error);
		}

		return $q.when(promise).then(function (result) {
			logMapAnalysisEvent(trace, 'analysis', 'success');
			mapAnalysisTraces.splice(mapAnalysisTraces.indexOf(trace), 1);
			logMapAnalysisEvent(trace, 'analysis', 'completion');
			return result;
		}, function (error) {
			logMapAnalysisEvent(trace, 'analysis', 'rejected', error);
			mapAnalysisTraces.splice(mapAnalysisTraces.indexOf(trace), 1);
			logMapAnalysisEvent(trace, 'analysis', 'completion');
			return $q.reject(error);
		});
	};

	var errorCallback = function (error) {
		var modalInstance = $modal.open({
			templateUrl: 'errorModal.html',
			controller: 'ErrorModal',
			resolve: {
				'error': function () {
					return error;
				}
			}
		});
	};

	var modServiceInstance = {
		'errorCallback': errorCallback,
		traceMapAnalysis: traceMapAnalysis,
		storage: null,
		storagePromise: null,
		data: null,
		defaultFileNode: {
			name: null,
			path: null,
			baseName: null,
			extension: null,
			fileType: null,
			metadata: null,
			lastMetadataCheck: null,
			dirLoaded: false,
			folders: [],
			files: [],
			count: 0,
			depth: 0,
			parent: null,
			specialView: false,
			isFile: false,
			isDirectory: false,
			byName: {},
			dirVisible: false,
			isCurrent: false,
		},
		defaultData: {
			dataVersion: '1.1.0',
			pathDisplayName: null,
			fileSystem: {
				root: null,
				byPath: {},
				current: null,
			},
			mod: {
				lastGenerated: null,
				sourceFiles: [''],
				sourceDataNodes: [],

				name: null,
				pathDisplayName: null,
				fileSystemId: null,
				fileSystemBackend: null,
				sourceManifest: [],
				shouldReattachSource: false,

				shouldRequestAccess: false,
			},
			pdxScriptData: {
				byPath: {},
				proto: {
					lastGenerated: null,
					localModified: null,
					sourceFiles: [],
					generateMethod: 'generatePdxScriptData',
					saveMethod: 'savePdxScriptData',
					data: null,
					file: null,
				}
			},
			yamlData: {
				byPath: {},
				proto: {
					lastGenerated: null,
					localModified: null,
					sourceFiles: [],
					generateMethod: 'generateYamlData',
					saveMethod: 'saveYamlData',
					data: null,
					file: null,
				}
			},
			csvData: {
				byPath: {},
				proto: {
					lastGenerated: null,
					localModified: null,
					sourceFiles: [],
					generateMethod: 'generateCsvData',
					saveMethod: 'saveCsvData',
					data: null,
					file: null,
				}
			},
			localisation: {
				lastGenerated: null,
				sourceFiles: ['localisation'],
				sourceDataNodes: [],
				generateMethod: 'generateLocalisation',
				saveMethod: 'saveLocalisation',
				byFile: {},
				byId: {},
				byLanguage: {},
				languages: [],
			},
			common: {
				religions: {
					lastGenerated: null,
					sourceFiles: [],
					sourceDataNodes: [],
					generateMethod: 'generateCommonColorDefinitions',
					definitionPath: 'common/religions',
					colorByName: {},
				},
				tradegoods: {
					lastGenerated: null,
					sourceFiles: [],
					sourceDataNodes: [],
					generateMethod: 'generateCommonColorDefinitions',
					definitionPath: 'common/tradegoods',
					colorByName: {},
				},
				governments: {
					lastGenerated: null,
					sourceFiles: [],
					sourceDataNodes: [],
					generateMethod: 'generateCommonColorDefinitions',
					definitionPath: 'common/governments',
					colorByName: {},
				},
			},
			countries: {
				tags: {
					lastGenerated: null,
					sourceFiles: ['common/country_tags'],
					generateMethod: 'generateCountryTags',
					byTag: {},
					byPath: {},
				},
				info: {
					lastGenerated: null,
					sourceFiles: ['common/countries'],
					generateMethod: 'generateCountryInfo',
					byTag: {},
					byPath: {},
				}
			},
			history: {
				provinces: {
					lastGenerated: null,
					sourceFiles: ['history/provinces'],
					sourceDataNodes: [],
					generateMethod: 'generateProvinceHistory',
					byId: [],
					provinceIds: [],
				},
				countries: {

				},
			},
			map: {
				areas: {
					lastGenerated: null,
					generateMethod: 'generateAreas',
					sourceDataNodes: [],
					list: [],
				},
				provinces: {
					image: {
						lastGenerated: null,
						sourceFiles: ['map/provinces.bmp'],
						generateMethod: 'generateMapImage',
						mapSource: 'provinces',
						imageBlob: null,
						imageCacheName: 'map/provinces.bmp',
					},
					info: {
						lastGenerated: null,
						sourceFiles: ['map/provinces.bmp'],
						generateMethod: 'generateMapInfo',
						mapSource: 'provinces',
						analytics: null,
					},
					grid: {
						lastGenerated: null,
						sourceFiles: ['map/provinces.bmp'],
						generateMethod: 'generateMapGrid',
						mapSource: 'provinces',
						imageBlob: null,
						imageCacheName: 'map/provinces.bmp:grid',
					},
				},
				seas: {
					image: {
						lastGenerated: null,
						sourceFiles: ['map/seas.png'],
						generateMethod: 'generateMapImage',
						mapSource: 'seas',
						imageBlob: null,
						imageCacheName: 'map/seas.png',
					},
					info: {
						lastGenerated: null,
						sourceFiles: ['map/seas.png'],
						generateMethod: 'generateMapInfo',
						mapSource: 'seas',
						analytics: null,
					},
					grid: {
						lastGenerated: null,
						sourceFiles: ['map/seas.png'],
						generateMethod: 'generateMapGrid',
						mapSource: 'seas',
						imageBlob: null,
						imageCacheName: 'map/seas.png:grid',
					},
				},
				environment: {
					lastGenerated: null,
					sourceFiles: [],
					byPath: {},
					nodesByName: {},
					generateMethod: 'generateMapEnvironment',
					saveMethod: 'saveMapEnvironment',
				},
				adjecencies: {
					lastGenerated: null,
					sourceFiles: [
						'map/adjecensies.csv',
					],
					generateMethod: 'generateMapAdjecensies',
				},
				decoration: {
					lastGenerated: null,
					sourceFiles: [
						'map/positions.txt',
						'map/ambient_object.txt',
						//'map/static.txt',
					],
					generateMethod: 'generateMapGrid',
					mapSource: 'provinces',
					imageBlob: null,
					imageCacheName: 'map/provinces.bmp:grid',
				},
				colorMapping: {
					lastGenerated: null,
					sourceFiles: ['map/definition.csv'],
					sourceDataNodes: [],
					generateMethod: 'generateMapColorMapping',
					byId: [],
					byColor: [],
				},
				provinceMapping: {
					lastGenerated: null,
					sourceFiles: [],
					sourceDataNodes: [],
					generateMethod: 'generateProvinceMapping',
					areaByProvinceId: [],
				},
			}
		},
		loadingState: {},
		imageCache: {},

		encodings: {
			// Windows code page 1252 Western European
			//
			cp1252: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f\u20ac\ufffd\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\ufffd\u017d\ufffd\ufffd\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\ufffd\u017e\u0178\xa0\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xab\xac\xad\xae\xaf\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xbb\xbc\xbd\xbe\xbf\xc0\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xdb\xdc\xdd\xde\xdf\xe0\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xfb\xfc\xfd\xfe\xff',
		},
		showMessage: function (message) {
			var deferred = $q.defer();
			$modal.open({
				templateUrl: 'messageModal.html',
				controller: 'MessageModal',
				resolve: {
					'message': function () {
						return message;
					},
					'resolve': function () {
						return deferred.resolve;
					},
				}
			});

			return deferred.promise;
		},
		selectProject: function () {
			return fileSystemAdapter.selectProject();
		},
		exportModZip: function (onProgress) {
			if (!this.data || !this.data.mod)
				return $q.reject(new Error('Load a mod before exporting it.'));
			if (typeof JSZip != 'function')
				return $q.reject(new Error('ZIP export is unavailable because JSZip did not load.'));

			var modName = this.data.mod.name || 'mod';
			return fileSystemAdapter.getFileList().then(function (entries) {
				var zip = new JSZip();
				var batchSize = 100;
				function addBatch(start) {
					var batch = entries.slice(start, start + batchSize);
					if (!batch.length)
						return $q.when();
					return $q.all(batch.map(function (entry) {
						return fileSystemAdapter.readFile(entry.path).then(function (file) {
							zip.file(entry.path, file);
						});
					})).then(function () {
						return addBatch(start + batchSize);
					});
				}

				return addBatch(0).then(function () {
					return zip.generateAsync({
						type: 'blob',
						compression: 'DEFLATE',
						compressionOptions: {level: 1},
						streamFiles: true
					}, function (metadata) {
						if (onProgress)
							$rootScope.$applyAsync(function () { onProgress(metadata.percent); });
					});
				});
			}).then(function (blob) {
				var fileName = modName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') + '.zip';
				var url = URL.createObjectURL(blob);
				var link = document.createElement('a');
				link.href = url;
				link.download = fileName;
				link.style.display = 'none';
				document.body.appendChild(link);
				link.click();
				link.remove();
				window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
				return blob;
			}.bind(this));
		},
		getImageByPath: function (path) {
			return this.getFile(path).then(function (file) {
				return this.getImage({
					imageCacheName: path,
					imageBlob: file,
				});
			}.bind(this));
		},
		getImage: function (dataNode) {
			return traceMapAnalysisPromise('decodeImage ('+ dataNode.imageCacheName +')', function () {
				var deferred = $q.defer();
				if (dataNode.imageCacheName in this.imageCache)
				{
					deferred.resolve(this.imageCache[dataNode.imageCacheName]);
				}
				else
				{
					loadImage(dataNode.imageBlob, function (img) {
						this.imageCache[dataNode.imageCacheName] = img;
						deferred.resolve(img);
					}.bind(this), {noRevoke: true});
				}
				return deferred.promise;
			}.bind(this));
		},
		/** @memberOf modService */
		getStorage: function () {
			if (this.storage)
				return $q.when(this.storage);
			if (this.storagePromise)
				return this.storagePromise;

			var deferred = $q.defer();
			var storagePromise = deferred.promise;
			this.storagePromise = storagePromise;
			var storage;
			storage = new IDBStore({
				storeName: 'JoroDoxMods',
				storePrefix: 'IDBWrapper-',
				dbVersion: 2,
				keyPath: 'id',
				autoIncrement: true,
				indexes: [
					{'name': 'pathDisplayName', 'unique': false}
				],
				onError: function (error) {
					this.storagePromise = null;
					deferred.reject(error);
				}.bind(this)
			}, function () {
				this.storage = storage;
				this.storagePromise = null;
				deferred.resolve(storage);
			}.bind(this));

			return storagePromise;
		},
		/** @memberOf modService */
		loadPreviousData: function () {
			var deferred = $q.defer();
			chrome.storage.local.get('lastLoadedModId', function(result) {
				if (result.lastLoadedModId)
				{
					if (this.data && this.data.mod && this.data.mod.fileSystemId)
						deferred.resolve();
					else if (!this.data || this.data.id != result.lastLoadedModId)
						deferred.resolve(this.loadModData(result.lastLoadedModId));
					else
						deferred.resolve();
				}
				else
				{
					deferred.reject('No previous mod used.');
				}
			}.bind(this));

			return deferred.promise;
		},
		/** @memberOf modService */
		getPreviousModData: function () {
			return this.getStorage().then(function (storage) {
				return $q(function (resolve, reject) {
					storage.query(resolve, {onError: reject});
				});
			});
		},
		deleteModData: function (modData) {
			var projectId = modData.mod.fileSystemId || String(modData.id);
			var removeStoredData = this.getStorage().then(function () {
				return $q(function (resolve, reject) {
					this.storage.remove(modData.id, resolve, reject);
				}.bind(this));
			}.bind(this));
			return $q.all([removeStoredData, fileSystemAdapter.deleteProject(projectId)]);
		},
		/** @memberOf modService */
		loadModData: function (id) {
			var deferred = $q.defer();
			this.getStorage().then(function () {
				this.storage.get(id, function (data) {
					if (!data) {
						deferred.reject(new Error('The saved mod could not be found.'));
						return;
					}

					if (!data.dataVersion || data.dataVersion !== this.defaultData.dataVersion) {
						this.storage.remove(id, function () {
							this.showMessage({title: 'JoroDox Extension Updated', text: 'The saved mod data is no longer compatible. Re-open the mod in Settings.'});
						}.bind(this));
						deferred.reject(new Error('The saved mod data is incompatible.'));
						return;
					}

					this.clearModData();
					this.data = data;
					this.data.mod = this.data.mod || {};
					angular.forEach(this.data.fileSystem && this.data.fileSystem.byPath || {}, function (fileNode) {
						if (!fileNode.metadata)
							return;
						var modifiedAt = fileNode.metadata.lastModified;
						if (typeof modifiedAt != 'number' && fileNode.metadata.lastModifiedDate)
							modifiedAt = new Date(fileNode.metadata.lastModifiedDate).getTime();
						modifiedAt = typeof modifiedAt == 'number' ? modifiedAt : 0;
						fileNode.metadata = {
							lastModified: modifiedAt,
							lastModifiedDate: new Date(modifiedAt),
							size: typeof fileNode.metadata.size == 'number' ? fileNode.metadata.size : 0
						};
					});
					var projectId = this.data.mod.fileSystemId || String(this.data.id);

					fileSystemAdapter.restoreProject(
						projectId,
						this.data.mod.fileSystemState || this.data.mod,
						this.data.mod.sourceManifest || []
					).then(function (project) {
						if (this.data !== data) {
							deferred.resolve();
							return;
						}

						this.data.mod.fileSystemId = project.id;
						this.data.mod.fileSystemBackend = project.backend;
						this.data.mod.shouldReattachSource = fileSystemAdapter.needsSource();
						delete this.data.mod.retainedRootFileEntry;

						if (this.data.fileSystem && this.data.fileSystem.root)
							this.data.fileSystem.root.dirVisible = true;

						var refresh = project.backend == 'chrome' && this.data.fileSystem.root
							? this.loadFileNodeDirectory(this.data.fileSystem.root)
							: $q.when();

						refresh.then(function () {
							if (this.data !== data) {
								deferred.resolve();
								return;
							}
							chrome.storage.local.set({'lastLoadedModId': data.id});
							deferred.resolve();
						}.bind(this), function (error) {
							if (error && error.code == 'permission-prompt')
								deferred.resolve();
							else
								deferred.reject(error);
						});
					}.bind(this), deferred.reject);
				}.bind(this), deferred.reject);
			}.bind(this), deferred.reject);

			return deferred.promise;
		},
		/** @memberOf modService */
		setRootFileEntry: function (project, dataId) {

			this.clearModData();

			if (dataId)
				this.data.id = dataId;

			this.data.mod.fileSystemId = project.id;
			this.data.mod.fileSystemBackend = project.backend;
			this.data.mod.sourceManifest = project.manifest || [];
			this.data.mod.shouldReattachSource = false;
			this.data.mod.name = project.rootName;

			var rootFileNode = angular.copy(this.defaultFileNode);
			rootFileNode.path = '';

			return this.loadFileNode(rootFileNode).then(function() {
				return this.loadFileNodeDirectory(rootFileNode);
			}.bind(this)).then(function() {
				this.data.pathDisplayName = this.data.mod.name;
				this.data.mod.pathDisplayName = this.data.mod.name;
			}.bind(this)).then(function () {
				return this.saveModData();
			}.bind(this));
		},
		attachSource: function () {
			return fileSystemAdapter.attachSource(
				this.data.mod.fileSystemId,
				this.data.mod.sourceManifest || []
			).then(function () {
				this.data.mod.shouldReattachSource = false;
				return this.loadFileNodeDirectory(this.data.fileSystem.root);
			}.bind(this));
		},
		/** @memberOf modService */
		saveModData: function () {
			if (!this.data)
				return $q.reject(new Error('Cannot save mod data before a mod is loaded.'));

			var deferred = $q.defer();
			var data = this.data;
			this.getStorage().then(function () {
				this.storage.put(data, function (id) {
					if (this.data !== data) {
						deferred.resolve();
						return;
					}
					data.id = id;
					chrome.storage.local.set({'lastLoadedModId': id}, function() {
						deferred.resolve();
					});
				}.bind(this), function (e) {console.log(e); deferred.reject(e);});
			}.bind(this), deferred.reject);

			return deferred.promise;
		},
		/** @memberOf modService */
		clearModData: function () {
			this.data = angular.copy(this.defaultData);
			this.imageCache = {};
		},
		setCurrent: function (node) {
			if (this.data.fileSystem.current)
				this.data.fileSystem.current.isCurrent = false;
			this.data.fileSystem.current = node;
			if (this.data.fileSystem.current)
				this.data.fileSystem.current.isCurrent = true;
		},
		/** @memberOf modService */
		refreshOpenDirectories: function (node) {

			if (!node)
				node = this.data.fileSystem.root;

			if (node.isDirectory && node.dirLoaded)// && node.dirVisible)
			{
				return this.loadFileNodeDirectory(node).then(function () {
					for (var i = 0; i < node.folders.length; i++)
						if (node.dirLoaded)
							this.refreshOpenDirectories(node.folders[i]);
				}.bind(this));
			}
			else
			{
				var deferred = $q.defer();
				deferred.resolve();
				return deferred.promise;
			}
		},
		/** @memberOf modService */
		convertUtf8ToBuffer: function (text, encoding) {
			if (encoding == 'cp1252')
			{
				var buffer = new Uint8Array(text.length);
				var enc = this.encodings[encoding];

				var len = text.length;
				for (var i = 0; i < len; i++)
				{
					buffer[i] = enc.indexOf(text[i]);
				}

				return buffer;
			}
			else
			{

			}
		},
		convertMalformedUtf8: function (text) {
			if (encoding == 'cp1252')
			{
				var buffer = new Uint8Array(text.length);
				var enc = this.encodings[encoding];

				var len = text.length;
				for (var i = 0; i < len; i++)
				{
					buffer[i] = enc.indexOf(text[i]);
				}

				return buffer;
			}
			else
			{

			}
		},
		getMetadata: function (fileNode) {
			return this.getFileEntry(fileNode.path).then(function (entry) {
				var lastModified = entry.kind == 'file' ? entry.lastModified : 0;
				fileNode.metadata = {
					lastModified: lastModified,
					lastModifiedDate: new Date(lastModified),
					size: entry.kind == 'file' ? entry.size : 0
				};
				fileNode.lastMetadataCheck = new Date();
				return fileNode.metadata;
			});
		},
		isNodeOutdatedQuick: function (dataNode, date) {
			if (('metadata' in dataNode) && dataNode.metadata)
			{
				if (dataNode.metadata.lastModifiedDate > dataNode.lastGenerated)
				{
					return true;
				}
				if (date && dataNode.metadata.lastModifiedDate > date)
				{
					return true;
				}
			}
			else if ('lastGenerated' in dataNode)
			{
				if (!dataNode.lastGenerated)
				{
					return true;
				}
				if (date && dataNode.lastGenerated > date)
				{
					return true;
				}
			}
			else
			{
				console.log('Node has no lastGenerated.');
				return false;
			}

			if ('sourceDataNodes' in dataNode)
			{
				for (var i = 0; i < dataNode.sourceDataNodes.length; i++)
					if (this.isNodeOutdatedQuick(dataNode.sourceDataNodes[i], dataNode.lastGenerated))
						return true;
			}

			if ('sourceFiles' in dataNode)
			{
				for (var i = 0; i < dataNode.sourceFiles.length; i++)
				{
					if (this.data.fileSystem.byPath[dataNode.sourceFiles[i]])
					{
						if (this.isNodeOutdatedQuick(this.data.fileSystem.byPath[dataNode.sourceFiles[i]], dataNode.lastGenerated))
							return true;
					}
					else
					{
						//return true;
					}
				}
			}

			return false;
		},
		isNodeOutdated: function (dataNode, date) {
			var deferred = $q.defer();

			if ('lastGenerated' in dataNode)
			{
				if (!dataNode.lastGenerated)
				{
					deferred.resolve(true);
					return deferred.promise;
				}
				if (date && dataNode.lastGenerated > date)
				{
					deferred.resolve(true);
					return deferred.promise;
				}
			}
			else
			{
				deferred.reject('Node has no lastGenerated.');
				return deferred.promise;
			}

			if (('metadata' in dataNode) && dataNode.metadata)
			{
				if (dataNode.metadata.lastModifiedDate > dataNode.lastGenerated)
				{
					deferred.resolve(true);
					return deferred.promise;
				}
			}

			// Node itself not outdated, but maybe one of its dependencies is...

			var promises = [];

			if ('metadata' in dataNode)
			{
				if (dataNode.metadata == null || dataNode.lastMetadataCheck == null || (new Date() - dataNode.lastMetadataCheck > 1000 * 600))
				{
					promises.push(this.getMetadata(dataNode).then(function (metadata) {
						return metadata.lastModifiedDate > dataNode.lastGenerated;
					}));
				}
			}

			if ('sourceDataNodes' in dataNode)
			{
				angular.forEach(dataNode.sourceDataNodes, function (sourceDataNode) {
					if (sourceDataNode)
					promises.push(this.isNodeOutdated(sourceDataNode, dataNode.lastGenerated));
				}, this);
			}

			if ('sourceFiles' in dataNode)
			{
				angular.forEach(dataNode.sourceFiles, function (sourceFile) {
					promises.push(this.getFileNodeByPath(sourceFile).then(function (fileNode) {
						if (!fileNode)
							return false;
						else
							return this.isNodeOutdated(fileNode);
					}.bind(this)));
				}, this);
			}

			$q.all(promises).then(
				function (results) {
					// If any of the results is true, then the node is outdated
					deferred.resolve(results.some(function(value) { return !!value; }));
				}
			);

			return deferred.promise;
		},
		getData: function (dataNode) {
			var label = dataNode && (dataNode.generateMethod || dataNode.sourceFiles) || 'unknown node';
			return traceMapAnalysisPromise('getData ('+ label +')', function () {
				if (!dataNode)
					console.log('Unknown datanode!');

				// Is already generating... wait for that
				if ('generatePromise' in dataNode && dataNode.generatePromise)
					return dataNode.generatePromise;

				if (this.isNodeOutdatedQuick(dataNode))
				{
					dataNode.generatePromise = this.generateData(dataNode);

					var clearGeneratePromise = function() {
						dataNode.generatePromise = null;
					};
					dataNode.generatePromise.then(clearGeneratePromise, clearGeneratePromise);

					return dataNode.generatePromise;
				}
				else
				{
					return $q.when(dataNode);
				}

				return this.isNodeOutdated(dataNode).then(function (isOutdated) {
					if (!isOutdated)
						return dataNode;
					else
					{
						dataNode.generatePromise = this.generateData(dataNode);

						dataNode.generatePromise.then(function() {
							dataNode.generatePromise = null;
						});

						return dataNode.generatePromise;
					}
				}.bind(this));
			}.bind(this));
		},
		getDataMultiple: function (dataNodes) {

			var promises = [];

			angular.forEach(dataNodes, function (dataNode) {
				promises.push(this.getData(dataNode));
			}.bind(this));

			return $q.all(promises);
		},
		generateData: function (dataNode) {
			var deferred = $q.defer();

			if ('generateMethod' in dataNode)
				return traceMapAnalysisPromise('generateData ('+ dataNode.generateMethod +')', function () {
					return this.loadDependencies(dataNode).then(function () {
						this.loadingState[dataNode.generateMethod] = true;

						return this[dataNode.generateMethod](dataNode);
					}.bind(this)).then(function () {
						this.loadingState[dataNode.generateMethod] = false;

						if (this[dataNode.generateMethod.replace('generate', 'link')])
							this[dataNode.generateMethod.replace('generate', 'link')](dataNode);

						dataNode.lastGenerated = new Date();
						return dataNode;
					}.bind(this), function (error) {
						this.loadingState[dataNode.generateMethod] = false;
						return $q.reject(error);
					}.bind(this));
				}.bind(this));
			else
				deferred.reject('Node `'+ dataNode +'` cannot generate data, no generateMethod set.');

			return deferred.promise;
		},
		saveData: function (dataNode) {
			if (!dataNode)
				console.log('Unknown datanode!');

			var deferred = $q.defer();

			if (!('saveMethod' in dataNode))
			{
				deferred.reject('Node `'+ dataNode +'` cannot save data, no saveMethod set.');
				return deferred.promise;
			}

			return this[dataNode.saveMethod](dataNode).then(function () {
				dataNode.localModified = null;
				return dataNode;
			}.bind(this));
		},
		watchData: function (dataNode) {
			if (!dataNode)
				console.log('Unknown datanode!');

			return this.isNodeOutdated(dataNode).then(function (isOutdated) {
				if (!isOutdated)
					return dataNode;
				else
				{
					dataNode.generatePromise = this.generateData(dataNode);

					dataNode.generatePromise.then(function() {
						dataNode.generatePromise = null;
					});

					return dataNode.generatePromise;
				}
			}.bind(this));
		},
		loadDependencies: function (dataNode) {
			return traceMapAnalysisPromise('loadDependencies ('+ (dataNode.generateMethod || dataNode.sourceFiles || 'data node') +')', function () {
				var promises = [];

				if ('metadata' in dataNode)
				{
					promises.push(this.getMetadata(dataNode));
				}

				if ('sourceDataNodes' in dataNode)
				{
					angular.forEach(dataNode.sourceDataNodes, function (sourceDataNode) {
						promises.push(this.isNodeOutdated(sourceDataNode).then(function (isOutdated) {
							if (isOutdated)
								return this.generateData(sourceDataNode);
						}.bind(this)));
					}, this);
				}

				if ('sourceFiles' in dataNode)
				{
					angular.forEach(dataNode.sourceFiles, function (sourceFile) {
						promises.push(this.getFileNodeByPath(sourceFile).catch(function (error) {
							var isOptionalEnvironmentFile = [
								'map/default.map',
								'map/climate.txt',
								'map/continent.txt',
								'map/region.txt',
								'map/seasons.txt',
								'map/terrain.txt',
							].indexOf(sourceFile) != -1;
							if (error && error.name == 'NotFoundError' && !isOptionalEnvironmentFile)
								console.error('[map-analysis] Missing mandatory file: '+ sourceFile, error);
							return $q.reject(error);
						}));
					}.bind(this));
				}

				return $q.all(promises).then(function () {
					return dataNode;
				});
			}.bind(this));
		},
		/** @memberOf modService */
		requestRootAccess: function() {
			return fileSystemAdapter.ensureAccess(true).then(function () {
				this.data.mod.shouldRequestAccess = false;
			}.bind(this));
		},
		/** @memberOf modService */
		getFileEntry: function (path, options, ignoreExist, isDir) {
			var expectedKind = isDir || (this.data.fileSystem.byPath[path] && this.data.fileSystem.byPath[path].isDirectory)
				? 'directory'
				: undefined;
			return traceMapAnalysisPromise('getEntry ('+ path +')', function () {
				return fileSystemAdapter.getEntry(path, expectedKind).catch(function (error) {
					if (error && error.code == 'permission-prompt')
						this.data.mod.shouldRequestAccess = true;
					if (ignoreExist && error && (error.name == 'NotFoundError' || error.name == 'InvalidModificationError'))
						return false;
					return $q.reject(error);
				}.bind(this));
			}.bind(this));
		},
		getFile: function (path, options) {
			return traceMapAnalysisPromise('readFile ('+ path +')', function () {
				return fileSystemAdapter.readFile(path).catch(function (error) {
					if (error && error.code == 'permission-prompt')
						this.data.mod.shouldRequestAccess = true;
					return $q.reject(error);
				}.bind(this));
			}.bind(this));
		},
		/** @memberOf modService */
		loadFileNodeDirectory: function (fileNode) {
			if (!fileNode.isDirectory)
			{
				var deferred = $q.defer();
				deferred.reject(fileNode +' is not a directory.');
				return deferred.promise;
			}

			return this.getFileEntry(fileNode.path).then(function (nodeEntry) {
				return this.readDir(nodeEntry).then(function (entries) {
					var promises = [];
					var foundNames = [];
					for (var entry of entries)
					{
						if (entry.name[0] == '.')
							continue;

						var path = entry.path;

						var subFileNode = this.data.fileSystem.byPath[path];

						if (!subFileNode)
						{
							subFileNode = angular.copy(this.defaultFileNode);
							subFileNode.path = path;
						}
						subFileNode.parent = fileNode;
						subFileNode.name = entry.name;
						subFileNode.depth = fileNode.depth + 1;

						// New subitem
						if (!fileNode.byName[entry.name])
						{
							if (entry.kind == 'file')
								fileNode.files.push(subFileNode);
							if (entry.kind == 'directory')
								fileNode.folders.push(subFileNode);

							fileNode.count++;
							fileNode.byName[entry.name] = subFileNode;
						}
						foundNames.push(entry.name);

						promises.push(this.loadFileNode(subFileNode));
					}

					for (var name in fileNode.byName)
					{
						if (foundNames.indexOf(name) == -1)
						{
							// File/Dir removed
							var deletedNode = fileNode.byName[name];

							if (deletedNode.isFile)
								fileNode.files.splice(fileNode.files.indexOf(deletedNode), 1);
							if (deletedNode.isDirectory)
								fileNode.folders.splice(fileNode.folders.indexOf(deletedNode), 1);

							delete(fileNode.byName[deletedNode.name]);
						}
					}

					fileNode.files.sort(function (a, b) { return a.name.localeCompare(b.name); });
					fileNode.folders.sort(function (a, b) { return a.name.localeCompare(b.name); });

					return $q.all(promises);
				}.bind(this)).then(function () {
					fileNode.dirLoaded = true;
					return fileNode;
				});
			}.bind(this)).then(function (fileNode) {
				//this.saveData();
				return fileNode;
			}.bind(this));
		},
		'getFileNodeByPath': function (path) {
			var deferred = $q.defer();

			if (this.data.fileSystem.byPath[path])
				deferred.resolve(this.data.fileSystem.byPath[path]);
			else
			{
				var fileNode = angular.copy(this.defaultFileNode);
				fileNode.path = path;

				return this.loadFileNode(fileNode);
			}

			return deferred.promise;
		},
		'loadFileNode': function (fileNode) {
			return this.getFileEntry(fileNode.path).then(function (entry) {
				var fileNameChanged = (fileNode.name != entry.name);

				fileNode.name = entry.name;
				fileNode.lastGenerated = new Date();

				fileNode.isFile = (entry.kind == 'file');
				fileNode.isDirectory = (entry.kind == 'directory');

				if (fileNode.isFile)
				{
					fileNode.extension = fileNode.name.lastIndexOf('.') != -1 ? fileNode.name.substring(fileNode.name.lastIndexOf('.') + 1) : null;
					fileNode.baseName = fileNode.name.lastIndexOf('.') != -1 ? fileNode.name.substring(0, fileNode.name.lastIndexOf('.')) : fileNode.name;

					if (fileNode.extension == 'txt')
					{
						var topDir = fileNode.path.substring(0, fileNode.path.indexOf('/'));

						if (
							// CK2
							topDir == 'common' || topDir == 'decisions' || topDir == 'events' || topDir == 'events'
							|| topDir == 'gfx' || topDir == 'history' || topDir == 'interface' || topDir == 'interface'
							|| topDir == 'map' || topDir == 'sound' || topDir == 'tutorial'
							// EU4
							|| topDir == 'hints' || topDir == 'missions')
						{
							fileNode.fileType = 'pdx-script';
							fileNode.specialView = true;
						}
						else
						{
							fileNode.fileType = 'text';
						}
					}
					else if (fileNode.extension == 'png' || fileNode.extension == 'bmp' || fileNode.extension == 'jpg' || fileNode.extension == 'gif')
					{
						fileNode.fileType = 'image';
					}
					else if (fileNode.extension == 'tga')
					{
						fileNode.fileType = 'image-tga';
					}
					else if (fileNode.extension == 'asset' || fileNode.extension == 'mod' || fileNode.extension == 'map' || fileNode.extension == 'gui' || fileNode.extension == 'gfx' || fileNode.extension == 'eu4')
					{
						fileNode.fileType = 'pdx-script';
						fileNode.specialView = true;
					}
					else if (fileNode.extension == 'anim')
					{
						fileNode.fileType = 'pdx-animation';
						fileNode.specialView = true;
					}
					else if (fileNode.extension == 'mesh')
					{
						fileNode.fileType = 'pdx-mesh';
						fileNode.specialView = true;
					}
					else if (fileNode.extension == 'json')
					{
						fileNode.fileType = 'json';
						fileNode.specialView = true;
					}
					else if (fileNode.extension == 'csv')
						fileNode.fileType = 'csv';
					else if (fileNode.extension == 'dds')
						fileNode.fileType = 'image-dds';
					else if (fileNode.extension == 'yml')
						fileNode.fileType = 'yml';
					else if (fileNode.extension == 'xml')
						fileNode.fileType = 'xml';
					else if (fileNode.extension == 'py')
						fileNode.fileType = 'python';
					else if (fileNode.extension == 'lua')
						fileNode.fileType = 'lua';
					else if (fileNode.extension == 'fxh')
						fileNode.fileType = 'hlsl-header';
					else if (fileNode.extension == 'dae')
					{
						fileNode.fileType = 'collada';
						fileNode.specialView = true;
					}
				}
				else
				{
					if (fileNode.path == 'map' || fileNode.path == 'history/provinces' || fileNode.path == 'history/countries')
						fileNode.specialView = true;
				}

				this.data.fileSystem.byPath[fileNode.path] = fileNode;
				if (fileNode.path == '')
					this.data.fileSystem.root = fileNode;

				return fileNode;
			}.bind(this));
		},
		'generateProvinceHistory': function (dataNode) {
			var historyPath = dataNode.sourceFiles[0];
			var getProvinceIdFromFileName = function (fileName) {
				var normalizedName = String(fileName || '').trim();
				if (!/\.txt$/i.test(normalizedName))
					return null;
				var match = /^([0-9]+)/.exec(normalizedName);
				if (!match)
					return null;
				var id = parseInt(match[1], 10);
				return isFinite(id) ? id : null;
			};
			return this.getFileEntry(historyPath, null, true, true).then(function (entry) {
				if (!entry)
				{
					console.info('[map-analysis] Missing optional province history directory: '+ historyPath);
					return {files: []};
				}
				return this.getFileNodeByPath(historyPath).then(function (node) {
					return this.loadFileNodeDirectory(node);
				}.bind(this));
			}.bind(this)).then(function (node) {
				var promises = [];
				dataNode.sourceDataNodes = [];
				dataNode.byId.length = 0;
				dataNode.provinceIds.length = 0;
				for (var i = 0; i < node.files.length; i++)
				{
					var file = node.files[i];
					var id = getProvinceIdFromFileName(file.name);
					if (id === null)
					{
						console.log(file.path +' not a province history file.')
						continue;
					}

					promises.push(function (path, id) {
						return this.getPdxScriptDataByPath(path).then(function (pdxDataNode) {
							dataNode.byId[id] = pdxDataNode;
							pdxDataNode._id = id;
							pdxDataNode._effectiveData = getEffectiveProvinceData(pdxDataNode);
							dataNode.provinceIds.push(id);
							dataNode.sourceDataNodes.push(pdxDataNode);
							pdxDataNode._addCores = [];

							if (angular.isArray(pdxDataNode.data.data['add_core']))
							{

							}
							else if (pdxDataNode.data.data['add_core'])
							{

							}


						});
					}.bind(this)(file.path, id));
				}

				return $q.all(promises).then(function () {
					var definitionPath = this.data.map.colorMapping.sourceFiles[0];
					return this.getFileEntry(definitionPath, null, true).then(function (entry) {
						if (!entry)
						{
							console.warn('[map-analysis] Cannot create fallback province records; missing definition file: '+ definitionPath);
							return dataNode;
						}

						return this.getData(this.data.map.colorMapping).then(function (mappings) {
							angular.forEach(mappings.byId, function (mapping) {
								if (!mapping || mapping.id === null || mapping.id === undefined)
									return;

								var id = parseInt(mapping.id, 10);
								if (!isFinite(id) || id < 0 || dataNode.byId[id])
									return;

								var baseName = String(id) +' - '+ (mapping.name || 'Province '+ id);
								var fileName = baseName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') +'.txt';
								var path = 'history/provinces/'+ fileName;
								var file = angular.copy(this.defaultFileNode);
								file.name = fileName;
								file.path = path;
								file.baseName = fileName.replace(/\.txt$/i, '');
								file.extension = 'txt';
								file.fileType = 'pdxScript';
								file.isFile = true;

								var province = angular.copy(this.data.pdxScriptData.proto);
								province.file = file;
								province.sourceFiles = [path];
								province.data = {
									type: 'rootScope',
									name: 'pdxScript',
									subNodes: [],
									depth: 0,
									comments: [],
									data: {
										base_tax: 0,
										base_production: 0,
										base_manpower: 0,
									},
								};
								province._id = id;
								province._effectiveData = angular.copy(province.data.data);
								province._isFallback = true;
								province._definition = mapping;
								province._addCores = [];
								dataNode.byId[id] = province;
								dataNode.provinceIds.push(id);
							}.bind(this));

							dataNode.provinceIds.sort(function (a, b) { return a - b; });
							return dataNode;
						}.bind(this));
					}.bind(this));
				}.bind(this));
			}.bind(this));
		},
		'setProvinceHistoryValue': function (province, key, value) {
			var targetBlock = null;
			var targetProperty = null;
			var targetDate = null;
			angular.forEach(province.data && province.data.subNodes, function (block) {
				var date = getProvinceHistoryDate(block.name);
				if (!date || compareProvinceHistoryDates(date, provinceHistoryReferenceDate) > 0)
					return;
				angular.forEach(block.subNodes, function (property) {
					if (property.name != key)
						return;
					if (!targetDate || compareProvinceHistoryDates(date, targetDate) >= 0)
					{
						targetBlock = block;
						targetProperty = property;
						targetDate = date;
					}
				});
			});
			if (targetProperty)
			{
				targetProperty.value = value;
				targetProperty.data = value;
				targetBlock.data[key] = value;
			}
			else
				province.data.data[key] = value;

			if (!province._effectiveData)
				province._effectiveData = {};
			province._effectiveData[key] = value;
		},
		'linkProvinceHistory': function (dataNode) {
			// look at all connections

			if (this.data.map.environment.lastGenerated)
				this.linkMapEnvironment(this.data.map.environment);
			if (this.data.countries.info.lastGenerated)
				this.linkCountryInfo(this.data.countries.info);
			if (this.data.map.provinces.info.lastGenerated)
				this.linkMapInfo(this.data.map.provinces.info);
			if (this.data.localisation.lastGenerated)
				this.linkLocalisation(this.data.localisation);
		},
		'generateCountryInfo': function (dataNode) {
			return this.getFileNodeByPath(dataNode.sourceFiles[0]).then(function (node) {
				return this.loadFileNodeDirectory(node);
			}.bind(this)).then(function (node) {
				var promises = [];
				for (var i = 0; i < node.files.length; i++)
				{
					var file = node.files[i];
					promises.push(function (path) {
						return this.getPdxScriptDataByPath(path).then(function (pdxDataNode) {
							dataNode.byPath[path] = pdxDataNode;
						});
					}.bind(this)(file.path));
				}

				return $q.all(promises).then(
					function (results) {
						return dataNode;
					}.bind(this)
				);
			}.bind(this));
		},
		'linkCountryInfo': function (dataNode) {
			// look at all connections

			if (this.data.localisation.lastGenerated)
				this.linkLocalisation(this.data.localisation);

			angular.forEach(dataNode.byPath, function(country) {
				// look at all connections
				if (this.data.countries.tags.lastGenerated)
				{
					country._tag = this.data.countries.tags.byPath[country.file.path.replace('common/', '')];
					if (country._tag)
						country._tag._country = country;
				}
				if (this.data.history.provinces.byId.length && country._tag)
				{
					angular.forEach(country._ownedProvinces, function (province) {
						province._country = null;
					});
					country._ownedProvinces = [];
					angular.forEach(this.data.history.provinces.byId, function (province) {
						var provinceData = province._effectiveData || province.data.data;
						if (provinceData.owner == country._tag.name)
						{
							country._ownedProvinces.push(province);
							province._country = country;
						}
					});
				}
			}.bind(this));
		},
		'generateCountryTags': function (dataNode) {
			return this.getFileNodeByPath(dataNode.sourceFiles[0]).then(function (node) {
				return this.loadFileNodeDirectory(node);
			}.bind(this)).then(function (node) {
				var promises = [];
				for (var i = 0; i < node.files.length; i++)
				{
					var file = node.files[i];
					promises.push(function (path) {
						return this.getPdxScriptDataByPath(path).then(function (pdxDataNode) {
							for (var j = 0; j < pdxDataNode.data.subNodes.length; j++)
							{
								dataNode.byTag[pdxDataNode.data.subNodes[j].name] = pdxDataNode.data.subNodes[j];
								dataNode.byPath[pdxDataNode.data.subNodes[j].value] = pdxDataNode.data.subNodes[j];
							}
						});
					}.bind(this)(file.path));
				}

				return $q.all(promises).then(
					function (results) {
						return dataNode;
					}
				);
			}.bind(this));
		},
		'generateMapEnvironment':  function (dataNode) {
			return traceMapAnalysisPromise('loadMapEnvironment', function () {
				return $q.when(dataNode);
			}.bind(this));
		},
		'generateCommonColorDefinitions': function (dataNode) {
			var sourcePath = dataNode.definitionPath;
			dataNode.colorByName = {};
			dataNode.sourceDataNodes = [];

			var readColor = function (value) {
				if (!angular.isArray(value) || value.length < 3)
					return null;
				var channels = value.slice(0, 3).map(function (channel) {
					return Number(channel);
				});
				if (channels.some(function (channel) {
					return !isFinite(channel) || channel < 0 || channel > 255;
				}))
					return null;

				var normalized = channels.every(function (channel) {
					return channel <= 1;
				}) && value.slice(0, 3).some(function (channel) {
					return /[.eE]/.test(String(channel));
				});
				return channels.map(function (channel) {
					return Math.round(normalized ? channel * 255 : channel);
				}).concat([255]);
			};
			var collectDefinitions = function (node) {
				var colorNode = null;
				angular.forEach(node.subNodes || [], function (child) {
					if (child.name == 'color')
						colorNode = child;
				});
				if (colorNode)
				{
					var color = readColor(colorNode.value);
					if (color)
						dataNode.colorByName[String(node.name).toLowerCase()] = color;
				}
				angular.forEach(node.subNodes || [], function (child) {
					if (child.name != 'color')
						collectDefinitions(child);
				});
			};
			var collectFiles = function (directory) {
				return this.loadFileNodeDirectory(directory).then(function (loadedDirectory) {
					var files = loadedDirectory.files.filter(function (file) {
						return /\.txt$/i.test(file.name);
					});
					var folderPromises = [];
					angular.forEach(loadedDirectory.folders, function (folder) {
						folderPromises.push(this.getFileNodeByPath(folder.path).then(function (childDirectory) {
							return collectFiles(childDirectory);
						}));
					}.bind(this));
					return $q.all(folderPromises).then(function (childFiles) {
						angular.forEach(childFiles, function (nestedFiles) {
							files = files.concat(nestedFiles);
						});
						return files;
					});
				}.bind(this));
			}.bind(this);

			return this.getFileEntry(sourcePath, null, true, true).then(function (entry) {
				if (!entry)
				{
					console.info('[map-analysis] Missing optional file: '+ sourcePath);
					dataNode.sourceFiles = [];
					return dataNode;
				}
				dataNode.sourceFiles = [sourcePath];
				return this.getFileNodeByPath(sourcePath).then(function (directory) {
					return collectFiles(directory);
				}).then(function (files) {
					files.sort(function (a, b) { return a.path.localeCompare(b.path); });
					var filePromises = [];
					angular.forEach(files, function (file) {
						filePromises.push(this.getPdxScriptDataByPath(file.path));
					}.bind(this));
					return $q.all(filePromises).then(function (scriptNodes) {
						dataNode.sourceDataNodes = scriptNodes;
						angular.forEach(scriptNodes, function (scriptNode) {
							collectDefinitions(scriptNode.data);
						});
						return dataNode;
					});
				}.bind(this));
			}.bind(this));
		},
		'loadMapEnvironment': function (fileNames) {
			var dataNode = this.data.map.environment;
			dataNode.sourceFiles = [];
			var pathsByName = {
				default: 'map/default.map',
				climate: 'map/climate.txt',
				continent: 'map/continent.txt',
				region: 'map/region.txt',
				area: 'map/area.txt',
				seasons: 'map/seasons.txt',
				terrain: 'map/terrain.txt',
			};
			var promises = [];

			return this.getData(dataNode).then(function () {
				angular.forEach(fileNames, function (fileName) {
					var path = pathsByName[fileName];
					if (!path)
						return;

					promises.push(this.getFileEntry(path, null, true).then(function (entry) {
						if (!entry)
						{
							console.info('[map-analysis] Missing optional file: '+ path);
							delete dataNode[fileName];
							delete dataNode.nodesByName[fileName];
							delete dataNode.byPath[path];
							return;
						}

						return this.getPdxScriptDataByPath(path).then(function (pdxNode) {
							dataNode[fileName] = pdxNode.data;
							dataNode.nodesByName[fileName] = pdxNode;
							dataNode.byPath[path] = pdxNode;
						}, function (error) {
							if (error && error.name == 'NotFoundError')
							{
								console.info('[map-analysis] Missing optional file: '+ path);
								delete dataNode[fileName];
								delete dataNode.nodesByName[fileName];
								delete dataNode.byPath[path];
								return;
							}
							return $q.reject(error);
						});
					}.bind(this)));
				}.bind(this));

				return $q.all(promises).then(function () {
					if (!dataNode.default)
						dataNode.default = {data: {}};
					this.linkMapEnvironment(dataNode);
					return dataNode;
				}.bind(this));
			}.bind(this));
		},
		'saveMapEnvironment':  function (dataNode) {
			var promises = [];
			var savedNodes = [];
			var saveNode = function (node) {
				if (node && savedNodes.indexOf(node) == -1)
				{
					savedNodes.push(node);
					promises.push(this.saveData(node));
				}
			}.bind(this);

			angular.forEach(dataNode, function (value, key) {
				if (key[0] == '_')
				{
					if (value._type == 'boolean' && '_provinces' in value)
					{
						var ids = [];
						for (var i = 0; i < value._provinces.length; i++)
							ids.push(value._provinces[i]._id);
						ids.sort(function (a, b) { return parseInt(a) - parseInt(b); });

						value.length = 0;
						for (var i = 0; i < ids.length; i++)
							value.push(ids[i]);

						saveNode(value._node);
					}
					else if (value._type == 'namedSet' || value._type == 'multipleNamed')
					{
						angular.forEach(value._nodeByName, function (node) {
							if ('_provinces' in node && angular.isArray(node.value))
							{
								var ids = [];
								for (var i = 0; i < node._provinces.length; i++)
									ids.push(node._provinces[i]._id);
								ids.sort(function (a, b) { return parseInt(a) - parseInt(b); });

								// Replace value with ids
								node.value.length = 0;
								Array.prototype.push.apply(node.value, ids);
							}
						});

						saveNode(value._node);
					}
				}
			}.bind(this));

			if (dataNode.regionsModified)
			{
				saveNode(dataNode.nodesByName.region);
				saveNode(dataNode.nodesByName.area);
			}

			return $q.all(promises).then(function () {
				if (dataNode.regionsModified)
					dataNode.regionsModified = false;
				return dataNode;
			}.bind(this));
		},
		'setProvinceClassification': function (province, key, value) {
			var settings = {
				_climate: {defaultValue: 'temperate', allowed: ['temperate', 'arid', 'tropical', 'arctic']},
				_winter: {defaultValue: 'no_winter', allowed: ['no_winter', 'mild_winter', 'normal_winter', 'severe_winter']},
				_monsoon: {defaultValue: 'no_monsoon', allowed: ['no_monsoon', 'mild_monsoon', 'normal_monsoon', 'severe_monsoon']},
			};
			var setting = settings[key];
			var environment = this.data.map.environment;
			var classificationSet = environment[key];
			if (!setting || !classificationSet || classificationSet._type != 'namedSet')
				return false;
			if (setting.allowed.indexOf(value) == -1)
				throw new Error('Unsupported '+ key +' classification: '+ value);

			var current = province[key];
			if (current && current._value == value)
				return false;

			var currentNode = current && current._type == 'namedSet' ? current : null;
			if (currentNode)
			{
				var currentIndex = currentNode._provinces.indexOf(province);
				if (currentIndex != -1)
					currentNode._provinces.splice(currentIndex, 1);
			}

			var rootSet = environment._climate;
			var node = classificationSet._nodeByName[value];
			if (!node && value != setting.defaultValue)
			{
				var values = [];
				var root = environment.climate;
				root.data[value] = values;
				node = {
					type: 'property',
					name: value,
					subNodes: [],
					depth: root.depth + 1,
					value: values,
					data: values,
					comments: [],
					icon: 'list',
				};
				root.subNodes.push(node);
				node._provinces = [];
				node._node = environment.nodesByName.climate;
				node._type = 'namedSet';
				node._value = value;
				node._displayName = value.replace(/_/g, ' ');
				rootSet._nodeByName[value] = node;
				if (key == '_winter')
					environment._winter._nodeByName[value] = node;
				else if (key == '_monsoon')
					environment._monsoon._nodeByName[value] = node;
			}

			if (node)
			{
				if (node._provinces.indexOf(province) == -1)
					node._provinces.push(province);
				province[key] = node;
			}
			else
			{
				var defaultNames = {
					temperate: 'temperate',
					no_winter: 'no winter',
					no_monsoon: 'no monsoon',
				};
				province[key] = {
					name: defaultNames[value],
					_value: value,
					_type: 'classification',
				};
			}
			return true;
		},
		'updateProvinceRegions': function (province, regionNames) {
			var environment = this.data.map.environment;
			var regionRoot = environment.region;
			var areaRoot = environment.area;
			if (!regionRoot || !areaRoot)
				throw new Error('Cannot edit province regions without map/region.txt and map/area.txt.');
			if (!angular.isArray(regionNames))
				throw new Error('Province region assignments must be a list.');

			var regionsByName = {};
			angular.forEach(regionRoot.subNodes, function (region) {
				regionsByName[region.name] = region;
			});
			var desiredRegions = [];
			var desiredNames = [];
			angular.forEach(regionNames, function (name) {
				if (!regionsByName[name])
					throw new Error('Unknown map region: '+ name);
				if (desiredNames.indexOf(name) == -1)
				{
					desiredNames.push(name);
					desiredRegions.push(regionsByName[name]);
				}
			});

			var currentNames = [];
			angular.forEach(province._regions || [], function (region) {
				currentNames.push(region.name);
			});
			currentNames.sort();
			desiredNames.sort();
			if (currentNames.join(',') == desiredNames.join(','))
				return false;

			var provinceId = String(province._id);
			var provinceAreas = [];
			angular.forEach(areaRoot.subNodes, function (area) {
				var ids = angular.isArray(area.value) ? area.value : [area.value];
				if (ids.indexOf(provinceId) != -1)
					provinceAreas.push(area);
			});
			if (provinceAreas.length > 1)
				throw new Error('Province '+ provinceId +' appears in multiple map areas; refusing to alter ambiguous region data.');

			var provinceArea = provinceAreas[0];
			if (provinceArea)
			{
				var ids = angular.isArray(provinceArea.value) ? provinceArea.value : [provinceArea.value];
				if (ids.length > 1)
				{
					var provinceIndex = ids.indexOf(provinceId);
					ids.splice(provinceIndex, 1);
					provinceArea.value = provinceArea.data = ids;
					provinceArea = null;
				}
			}

			if (!provinceArea)
			{
				var areaNameBase = 'jorodox_'+ provinceId +'_area';
				var areaName = areaNameBase;
				var suffix = 2;
				while (areaRoot.data[areaName])
					areaName = areaNameBase +'_'+ suffix++;

				var newIds = [provinceId];
				provinceArea = {
					type: 'property',
					name: areaName,
					subNodes: [],
					depth: areaRoot.depth + 1,
					value: newIds,
					data: newIds,
					comments: [],
					icon: 'list',
				};
				areaRoot.subNodes.push(provinceArea);
				areaRoot.data[areaName] = newIds;
			}

			var areaNameForProvince = provinceArea.name;
			angular.forEach(regionRoot.subNodes, function (region) {
				var areaNames = region.data.areas;
				if (!angular.isArray(areaNames))
					areaNames = areaNames ? [areaNames] : [];
				var existingIndex = areaNames.indexOf(areaNameForProvince);
				var shouldContain = desiredNames.indexOf(region.name) != -1;
				if (shouldContain && existingIndex == -1)
					areaNames.push(areaNameForProvince);
				else if (!shouldContain && existingIndex != -1)
					areaNames.splice(existingIndex, 1);

				if (shouldContain || existingIndex != -1)
				{
					region.data.areas = areaNames;
					var areasNode = null;
					angular.forEach(region.subNodes, function (child) {
						if (child.name == 'areas')
							areasNode = child;
					});
					if (!areasNode)
					{
						areasNode = {
							type: 'property',
							name: 'areas',
							subNodes: [],
							depth: region.depth + 1,
							comments: [],
							icon: 'list',
						};
						region.subNodes.push(areasNode);
					}
					areasNode.value = areasNode.data = areaNames;
				}
			});

			angular.forEach(regionRoot.subNodes, function (region) {
				var regionProvinces = region._provinces || [];
				var index = regionProvinces.indexOf(province);
				if (index != -1)
					regionProvinces.splice(index, 1);
			});
			province._regions.length = 0;
			province._regions._type = 'multipleNamed';
			angular.forEach(desiredRegions, function (region) {
				province._regions.push(region);
				if (region._provinces.indexOf(province) == -1)
					region._provinces.push(province);
			});
			environment.regionsModified = true;
			return true;
		},
		'linkMapEnvironment': function (dataNode) {
			this.data.history.provinces._environment = dataNode;
			delete dataNode._isSeaStart;
			delete dataNode._isLake;
			delete dataNode._isForcedCoastal;
			delete dataNode._climate;
			delete dataNode._winter;
			delete dataNode._monsoon;
			delete dataNode._continent;
			delete dataNode._regions;

			if (this.data.history.provinces.byId.length)
			{
				var defaultClassification = function (name) {
					var values = {
						temperate: 'temperate',
						'no winter': 'no_winter',
						'no monsoon': 'no_monsoon',
					};
					return {name: name, _value: values[name], _type: 'classification'};
				};
				angular.forEach(this.data.history.provinces.byId, function (province) {
					province._isSeaStart = null;
					province._isLake = null;
					province._isForcedCoastal = null;
					province._climate = defaultClassification('temperate');
					province._winter = defaultClassification('no winter');
					province._monsoon = defaultClassification('no monsoon');
					province._continent = null;
					province._regions = [];
					province._regions._type = 'multipleNamed';
				});
			}

			// Connect things
			if (this.data.history.provinces.byId.length && dataNode.default && dataNode.default.data.sea_starts)
			{
				dataNode.default.data.sea_starts._provinces = [];
				dataNode.default.data.sea_starts._node = dataNode.nodesByName.default;
				dataNode.default.data.sea_starts._type = 'boolean';
				dataNode._isSeaStart = dataNode.default.data.sea_starts;

				angular.forEach(dataNode.default.data.sea_starts, function (provinceId) {
					if (this.data.history.provinces.byId[provinceId])
					{
						var province = this.data.history.provinces.byId[provinceId];

						province._isSeaStart = dataNode.default.data.sea_starts;
						if (dataNode.default.data.sea_starts._provinces.indexOf(province) == -1)
							dataNode.default.data.sea_starts._provinces.push(province);
					}
				}.bind(this));
			}
			if (this.data.history.provinces.byId.length && dataNode.default && dataNode.default.data.lakes)
			{
				dataNode.default.data.lakes._provinces = [];
				dataNode.default.data.lakes._node = dataNode.nodesByName.default;
				dataNode.default.data.lakes._type = 'boolean';
				dataNode._isLake = dataNode.default.data.lakes;

				angular.forEach(dataNode.default.data.lakes, function (provinceId) {
					if (this.data.history.provinces.byId[provinceId])
					{
						var province = this.data.history.provinces.byId[provinceId];

						province._isLake = dataNode.default.data.lakes;
						if (dataNode.default.data.lakes._provinces.indexOf(province) == -1)
							dataNode.default.data.lakes._provinces.push(province);
					}
				}.bind(this));
			}
			if (this.data.history.provinces.byId.length && dataNode.default && dataNode.default.data.force_coastal)
			{
				dataNode.default.data.force_coastal._provinces = [];
				dataNode.default.data.force_coastal._node = dataNode.nodesByName.default;
				dataNode.default.data.force_coastal._type = 'boolean';
				dataNode._isForcedCoastal = dataNode.default.data.force_coastal;

				angular.forEach(dataNode.default.data.force_coastal, function (provinceId) {
					if (this.data.history.provinces.byId[provinceId])
					{
						var province = this.data.history.provinces.byId[provinceId];

						province._isForcedCoastal = dataNode.default.data.force_coastal;
						if (dataNode.default.data.force_coastal._provinces.indexOf(province) == -1)
							dataNode.default.data.force_coastal._provinces.push(province);
					}
				}.bind(this));
			}
			if (this.data.history.provinces.byId.length && dataNode.climate)
			{
				dataNode._climate = dataNode.climate;
				dataNode.climate._type = 'namedSet';
				dataNode.climate._node = dataNode.nodesByName.climate;
				dataNode._climate._nodeByName = {};
				dataNode._winter = {_type: 'namedSet', _node: dataNode.nodesByName.climate, _nodeByName: {}};
				dataNode._monsoon = {_type: 'namedSet', _node: dataNode.nodesByName.climate, _nodeByName: {}};
				var classificationKeys = {
					tropical: '_climate',
					arid: '_climate',
					arctic: '_climate',
					mild_winter: '_winter',
					normal_winter: '_winter',
					severe_winter: '_winter',
					mild_monsoon: '_monsoon',
					normal_monsoon: '_monsoon',
					severe_monsoon: '_monsoon',
				};

				angular.forEach(dataNode.climate.subNodes, function (climate) {
					climate._provinces = [];
					climate._node = dataNode.climate._node;
					dataNode._climate._nodeByName[climate.name] = climate;
					climate._type = 'namedSet';
					climate._displayName = climate.name.replace(/_/g, ' ');
					climate._value = climate.name;
					if (!angular.isArray(climate.value) && climate.value !== null && !angular.isObject(climate.value))
					{
						climate.value = [climate.value];
						climate.data = climate.value;
						dataNode.climate.data[climate.name] = climate.value;
					}
					if (classificationKeys[climate.name] == '_winter')
						dataNode._winter._nodeByName[climate.name] = climate;
					else if (classificationKeys[climate.name] == '_monsoon')
						dataNode._monsoon._nodeByName[climate.name] = climate;

					angular.forEach(angular.isArray(climate.value) ? climate.value : [], function (provinceId) {
						if (this.data.history.provinces.byId[provinceId])
						{
							var province = this.data.history.provinces.byId[provinceId];
							var classificationKey = classificationKeys[climate.name];
							if (classificationKey)
								province[classificationKey] = climate;
							if (climate._provinces.indexOf(province) == -1)
								climate._provinces.push(province);
						}
					}.bind(this));
				}.bind(this));
			}
			else
			{
				dataNode._climate = {_type: 'classification'};
				dataNode._winter = {_type: 'classification'};
				dataNode._monsoon = {_type: 'classification'};
			}
			if (this.data.history.provinces.byId.length && dataNode.continent)
			{
				dataNode._continent = dataNode.continent;
				dataNode.continent._type = 'namedSet';
				dataNode.continent._node = dataNode.nodesByName.continent;
				dataNode._continent._nodeByName = {};

				angular.forEach(dataNode.continent.subNodes, function (continent) {
					continent._provinces = [];
					continent._node = dataNode.continent._node;
					dataNode._continent._nodeByName[continent.name] = continent;
					continent._type = 'namedSet';

					angular.forEach(continent.value, function (provinceId) {
						if (this.data.history.provinces.byId[provinceId])
						{
							var province = this.data.history.provinces.byId[provinceId];

							province._continent = continent;
							if (continent._provinces.indexOf(province) == -1)
								continent._provinces.push(province);
						}
					}.bind(this));
				}.bind(this));
			}
			if (this.data.history.provinces.byId.length)
			{
				dataNode._regions = {_type: 'classification'};

				angular.forEach(this.data.history.provinces.byId, function (province) {
					if (!province._regions)
					{
						province._regions = [];
						province._regions._type = 'multipleNamed';
					}
					else
					{
						province._regions.length = 0;
					}
				});
			}

			if (this.data.history.provinces.byId.length && dataNode.region && dataNode.area)
			{
				dataNode._regions._nodeByName = {};
				var areasByName = {};
				angular.forEach(dataNode.area.subNodes, function (area) {
					areasByName[area.name] = area;
				});
				angular.forEach(dataNode.region.subNodes, function (region) {
					region._provinces = [];
					region._node = dataNode.nodesByName.region;
					dataNode._regions._nodeByName[region.name] = region;

					var areaNames = region.data && region.data.areas;
					if (!angular.isArray(areaNames))
					{
						var areasNode = null;
						angular.forEach(region.subNodes, function (child) {
							if (child.name == 'areas')
								areasNode = child;
						});
						areaNames = areasNode && areasNode.value;
					}
					if (!angular.isArray(areaNames))
						areaNames = areaNames ? [areaNames] : [];

					angular.forEach(areaNames, function (areaName) {
						var area = areasByName[areaName];
						if (!area)
							return;
						var provinceIds = angular.isArray(area.value) ? area.value : [area.value];
						angular.forEach(provinceIds, function (provinceId) {
							var province = this.data.history.provinces.byId[provinceId];
							if (!province)
								return;

							if (province._regions.indexOf(region) == -1)
								province._regions.push(region);
							if (region._provinces.indexOf(province) == -1)
								region._provinces.push(province);
						}.bind(this));
					}.bind(this));
				}.bind(this));
			}
		},
		'getPdxScriptDataByPath': function (path) {
			return traceMapAnalysisPromise('getPdxScriptData ('+ path +')', function () {
				// Make data-wrapper
				if (!this.data.pdxScriptData.byPath[path])
				{
					this.data.pdxScriptData.byPath[path] = angular.copy(this.data.pdxScriptData.proto);
					this.data.pdxScriptData.byPath[path].sourceFiles = [path];
					return this.generateData(this.data.pdxScriptData.byPath[path]);
				}
				else if (this.isNodeOutdatedQuick(this.data.pdxScriptData.byPath[path]))
				{
					return this.generateData(this.data.pdxScriptData.byPath[path]);
				}
				else
				{
					return $q.when(this.data.pdxScriptData.byPath[path]);
				}
			}.bind(this));
		},
		'getYamlDataByPath': function (path) {
			// Make data-wrapper
			if (!this.data.yamlData.byPath[path])
			{
				this.data.yamlData.byPath[path] = angular.copy(this.data.yamlData.proto);
				this.data.yamlData.byPath[path].sourceFiles = [path];
			}

			return this.generateData(this.data.yamlData.byPath[path]);
		},
		'getCsvDataByPath': function (path) {
			// Make data-wrapper
			if (!this.data.csvData.byPath[path])
			{
				this.data.csvData.byPath[path] = angular.copy(this.data.csvData.proto);
				this.data.csvData.byPath[path].sourceFiles = [path];
			}

			return this.generateData(this.data.yamlData.byPath[path]);
		},
		'generatePdxScriptData': function (dataNode) {
			dataNode.data = null;
			return traceMapAnalysisPromise('parsePdxScript ('+ dataNode.sourceFiles[0] +')', function () {
				return this.getFileText(dataNode.sourceFiles[0]).then(function (text) {
					dataNode.data = pdxScriptService.readFile(text);

					/*$rootScope.$watch(function () {
						return dataNode.data;
					}, function (newValue, oldValue) {
						dataNode.localModified = new Date();
					});*/

					return this.getFileNodeByPath(dataNode.sourceFiles[0]).then(function (node) {
						dataNode.file = node;
						return dataNode;
					}.bind(this));
				}.bind(this));
			}.bind(this));
		},
		'savePdxScriptData': function (dataNode) {
			var pdxScriptText = pdxScriptService.writeData(dataNode.data.data);

			return this.writeFileText(dataNode.file.path, pdxScriptText, 'cp1252', true).then(function () {
				return this.getMetadata(dataNode.file);
			}.bind(this));
		},
		'parseLocalisationText': function (text) {
			var data = {};
			var language = null;
			var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
			angular.forEach(lines, function (line) {
				var trimmed = line.trim();
				if (!trimmed || trimmed[0] == '#')
					return;

				var languageMatch = trimmed.match(/^([A-Za-z0-9_]+):\s*$/);
				if (languageMatch)
				{
					language = languageMatch[1];
					if (!data[language])
						data[language] = {};
					return;
				}

				var entryMatch = trimmed.match(/^([^:\s]+):(\d+)\s+"(.*)"\s*(?:#.*)?$/);
				if (!language || !entryMatch)
					return;

				var value = entryMatch[3].replace(/\\(.)/g, function (match, character) {
					if (character == 'n') return '\n';
					if (character == 'r') return '\r';
					if (character == 't') return '\t';
					if (character == '"' || character == '\\') return character;
					return match;
				});
				data[language][entryMatch[1] +':'+ entryMatch[2]] = value;
			});
			return data;
		},
		'serializeLocalisationText': function (data, originalText) {
			var lines = originalText.split(/\r?\n/);
			var output = [];
			var seen = {};
			var language = null;
			var escapeValue = function (value) {
				if (angular.isObject(value) && '_text' in value)
					value = value._text;
				return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
					.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
			};
			var appendMissingEntries = function (currentLanguage) {
				var entries = data[currentLanguage];
				if (!entries)
					return;
				if (!seen[currentLanguage])
					seen[currentLanguage] = {};

				angular.forEach(entries, function (value, key) {
					if (seen[currentLanguage][key])
						return;
					var keyMatch = key.match(/^(.+?)(?::(\d+))?$/);
					if (!keyMatch)
						return;
					output.push('\t'+ keyMatch[1] +':'+ (keyMatch[2] || '0') +' "'+ escapeValue(value) +'"');
				});
			};

			angular.forEach(lines, function (line) {
				var normalizedLine = line.replace(/^\uFEFF/, '').trim();
				var languageMatch = normalizedLine.match(/^([A-Za-z0-9_]+):\s*$/);
				if (languageMatch)
				{
					if (language)
						appendMissingEntries(language);
					language = languageMatch[1];
					if (!seen[language])
						seen[language] = {};
					output.push(line);
					return;
				}

				var entryMatch = line.match(/^(\s*)([^:\s]+):(\d+)\s+"(.*)"\s*(#.*)?$/);
				if (language && entryMatch)
				{
					var key = entryMatch[2] +':'+ entryMatch[3];
					var value = data[language] && data[language][key];
					if (value !== undefined)
						line = entryMatch[1] + key +' "'+ escapeValue(value) +'"'+ (entryMatch[5] || '');
					seen[language][key] = true;
				}
				output.push(line);
			});
			if (language)
				appendMissingEntries(language);
			return output.join('\n');
		},
		'generateYamlData': function (dataNode) {
			dataNode.data = null;
			return this.getFileText(dataNode.sourceFiles[0]).then(function (text) {
				if (dataNode.sourceFiles[0].indexOf('localisation/') == 0)
				{
					dataNode.localisationSourceText = text;
					dataNode.data = this.parseLocalisationText(text);
				}
				else
				{
					text = text.replace(/^\uFEFF/, '');
					try
					{
						dataNode.data = jsyaml.safeLoad(text);
					}
					catch (e)
					{
						console.log(e);
					}
				}

				/*$rootScope.$watch(function () {
					return dataNode.data;
				}, function (newValue, oldValue) {
					dataNode.localModified = new Date();
				}, true);*/

				return this.getFileNodeByPath(dataNode.sourceFiles[0]).then(function (node) {
					dataNode.file = node;
					return dataNode;
				}.bind(this));
			}.bind(this), 'utf8');
		},
		'generateCsvData': function (dataNode) {
			dataNode.data = null;
			return this.getFileText(dataNode.sourceFiles[0]).then(function (text) {
				dataNode.data = jsyaml.safeLoad(text);

				/*$rootScope.$watch(function () {
					return dataNode.data;
				}, function (newValue, oldValue) {
					dataNode.localModified = new Date();
				}, true);*/

				return this.getFileNodeByPath(dataNode.sourceFiles[0]).then(function (node) {
					dataNode.file = node;
					return dataNode;
				}.bind(this));
			}.bind(this));
		},
		'convertToPlainData': function (value) {
			if (angular.isObject(value))
			{
				if ('_text' in value)
					return value._text;

				var copy = {};
				angular.forEach(value, function (v, k) {
					if (k[0] != '_')
						copy[k] = this.convertToPlainData(v);
				}.bind(this));
				return copy;
			}
			return value;
		},
		'saveYamlData': function (dataNode) {
			var yamlText = dataNode.localisationSourceText !== undefined
				? this.serializeLocalisationText(dataNode.data, dataNode.localisationSourceText)
				: jsyaml.dump(this.convertToPlainData(dataNode.data));

			return this.writeFileText(dataNode.file.path, yamlText, 'utf-8', true).then(function () {
				if (dataNode.localisationSourceText !== undefined)
					dataNode.localisationSourceText = yamlText;
				return this.getMetadata(dataNode.file);
			}.bind(this));;
		},
		'generateMapImage': function (dataNode) {
			return traceMapAnalysisPromise('generateMapImage ('+ dataNode.sourceFiles[0] +')', function () {
				return this.getFile(dataNode.sourceFiles[0]).then(function (file) {
					dataNode.imageBlob = file;
					return dataNode;
				});
			}.bind(this));
		},
		'generateMapInfo': function (dataNode) {
			return traceMapAnalysisPromise('analyzeColorMap ('+ dataNode.mapSource +')', function () {
				return this.getData(this.data.map[dataNode.mapSource].image).then(function (imageNode) {
					return this.getImage(imageNode);
				}.bind(this)).then(function (image) {
					dataNode.analytics = mapAnalyzeService.analyzeColorMap(image);
					return dataNode;
				}.bind(this));
			}.bind(this));
		},
		'linkMapInfo': function (dataNode) {
			// look at all connections

			if (this.data.map.colorMapping.lastGenerated)
				this.linkMapColorMapping(this.data.map.colorMapping);

			for (var color in dataNode.analytics.colors)
			{
				if (dataNode.analytics.colors.hasOwnProperty(color))
				{
					var area = dataNode.analytics.colors[color];
					// look at all connections
					if (this.data.history.provinces.byId.length && area._colorMapping)
					{
						area._province = this.data.history.provinces.byId[area._colorMapping.id];
						if (area._province)
							area._province._area = area;
					}
				}
			}
		},
		'generateMapGrid': function (dataNode) {
			return traceMapAnalysisPromise('generateMapGrid ('+ dataNode.mapSource +')', function () {
				return $q.all({
					info: this.getData(this.data.map[dataNode.mapSource].info),
					image: this.getData(this.data.map[dataNode.mapSource].image).then(function (dataNode) { return this.getImage(dataNode); }.bind(this))
				}).then(function (data) {
					var img = mapAnalyzeService.borderImage(data.image, data.info.analytics.colors, false);
					// Hack! imageBlob not actually set
					//dataNode.imageBlob = new Blob([img.src], {type: 'image/png'});
					this.imageCache[dataNode.imageCacheName] = img;
					return dataNode;
				}.bind(this));
			}.bind(this));
		},
		'generateMapColorMapping': function (dataNode) {
			return traceMapAnalysisPromise('parseColorMapping (map/definition.csv)', function () {
				return this.getFileText('map/definition.csv').then(function (text) {
					dataNode.byId = [];
					dataNode.byColor = [];

					var csv = Papa.parse(text, {delimiter: ';', skipEmptyLines: true});
					if (csv.errors.length)
						console.warn('[map-analysis] Errors parsing map/definition.csv:', csv.errors);

					angular.forEach(csv.data, function (fields) {
						var idText = String(fields[0] || '').replace(/^\uFEFF/, '').trim();
						if (!idText || idText.toLowerCase() == 'province')
							return;

						var redText = String(fields[1] || '').trim();
						var greenText = String(fields[2] || '').trim();
						var blueText = String(fields[3] || '').trim();
						if (!/^\d+$/.test(idText) || !/^\d+$/.test(redText)
							|| !/^\d+$/.test(greenText) || !/^\d+$/.test(blueText))
						{
							console.warn('[map-analysis] Ignoring invalid map/definition.csv row:', fields);
							return;
						}

						var id = Number(idText);
						var red = Number(redText);
						var green = Number(greenText);
						var blue = Number(blueText);
						if (!isFinite(id) || Math.floor(id) != id || id < 0
							|| !isFinite(red) || Math.floor(red) != red || red < 0 || red > 255
							|| !isFinite(green) || Math.floor(green) != green || green < 0 || green > 255
							|| !isFinite(blue) || Math.floor(blue) != blue || blue < 0 || blue > 255)
						{
							console.warn('[map-analysis] Ignoring invalid map/definition.csv row:', fields);
							return;
						}

						var centerText = String(fields[5] || '').trim();
						var centerParts = centerText.split(',');
						var center = null;
						if (centerParts.length == 2)
						{
							var centerX = Number(centerParts[0].trim());
							var centerY = Number(centerParts[1].trim());
							if (isFinite(centerX) && isFinite(centerY))
								center = [centerX, centerY];
						}

						var mapping = {
							id: String(id),
							r: red,
							g: green,
							b: blue,
							colorNum: red << 16 | green << 8 | blue,
							name: String(fields[4] || '').trim(),
							center: center,
							sourceRow: fields.join(';'),
						};

						dataNode.byId[id] = mapping;
						if (!dataNode.byColor[mapping.colorNum])
							dataNode.byColor[mapping.colorNum] = mapping;
					});

					return dataNode;
				}.bind(this));
			}.bind(this));
		},
		'linkMapColorMapping': function (dataNode) {
			// look at all connections
			angular.forEach(dataNode.byId, function(colorMapping) {
				if (this.data.map.provinces.info.analytics)
				{
					colorMapping._area = this.data.map.provinces.info.analytics.colors[colorMapping.colorNum];
					if (colorMapping._area)
						colorMapping._area._colorMapping = colorMapping;
				}
			}.bind(this));
		},
		'generateProvinceMapping': function (dataNode) {
			return this.getData(this.data.map.colorMapping).then(function (mappings) {
				return this.getData(this.data.map.provinces.info).then(function (mapInfo) {
					dataNode.areaByProvinceId = [];
					var mappingsByColor = {};
					for (var i = 0; i < mappings.byId.length; i++)
					{
						var mapping = mappings.byId[i];
						if (!mapping)
							continue;

						if (!mappingsByColor[mapping.colorNum])
							mappingsByColor[mapping.colorNum] = [];
						mappingsByColor[mapping.colorNum].push({provinceId: i, mapping: mapping});

						if (mapInfo.analytics.colors[mapping.colorNum])
						{
							dataNode.areaByProvinceId[i] = mapInfo.analytics.colors[mapping.colorNum];
						}
					}

					var fallbackAreasByColor = mapAnalyzeService.findUniqueColorFallbacks(
						mappingsByColor,
						mapInfo.analytics.colors
					);
					for (var fallbackColorNum in fallbackAreasByColor)
					{
						if (!fallbackAreasByColor.hasOwnProperty(fallbackColorNum))
							continue;

						var candidate = mappingsByColor[fallbackColorNum][0];
						dataNode.areaByProvinceId[candidate.provinceId] = fallbackAreasByColor[fallbackColorNum];
					}
					return dataNode;
				}.bind(this));
			}.bind(this));
		},
		'getProvinceNamesByArea': function() {
			return modService.getData(modService.data.history.provinces).then(function (provinces) {
				return modService.getData(modService.data.map.provinceMapping).then(function (mapping) {

					modService.getData(modService.data.localisation).then(function (localisation) {
						$scope.dataViewInfo.provinceLocalisationLanguage = 'l_english';
						$scope.dataViewInfo.provinceLocalisationId = 'PROV'+ provinceId;
						if (localisation.byLanguage['l_english'])
							$scope.dataViewInfo.provinceLocalisation = localisation.byLanguage['l_english']['PROV'+ provinceId];
					});

				});
			});
		},
		'generateAreas': function (dataNode) {
			return this.getData(this.data.map.provinces.info).then(function (node) {

				if (dataNode.sourceDataNodes.indexOf(node) == -1)
					dataNode.sourceDataNodes.push(node);

				for (var color in node.analytics.colors)
				{
					if (node.analytics.colors.hasOwnProperty(color))
					{
						var area = node.analytics.colors[color];
						dataNode.list.push(area);
					}
				}
			}.bind(this));
		},
		'generateLocalisation': function (dataNode) {
			return this.getFileNodeByPath(dataNode.sourceFiles[0]).then(function (node) {
				return this.loadFileNodeDirectory(node);
			}.bind(this)).then(function (node) {
				var promises = [];
				dataNode.byId = {};
				dataNode.byLanguage = {};
				dataNode.languages = [];
				dataNode.sourceDataNodes.length = 0;

				for (var i = 0; i < node.files.length; i++)
				{
					var file = node.files[i];
					if (file.extension == 'yml')
					{
						promises.push(function (path) {

							return this.getYamlDataByPath(path).then(function (yamlDataNode) {
								dataNode.byFile[path] = yamlDataNode;
								dataNode.sourceDataNodes.push(yamlDataNode);
								var language;
								var localisationId;
								for (language in yamlDataNode.data)
								{
									if (yamlDataNode.data.hasOwnProperty(language))
									{
										for (localisationId in yamlDataNode.data[language])
										{
											if (yamlDataNode.data[language].hasOwnProperty(localisationId))
											{
												var canonicalLocalisationId = localisationId.replace(/:\d+$/, '');
												yamlDataNode.data[language][localisationId] = new String(yamlDataNode.data[language][localisationId]);

												yamlDataNode.data[language][localisationId]._text = yamlDataNode.data[language][localisationId].toString();
												yamlDataNode.data[language][localisationId]._node = yamlDataNode;

												if (!dataNode.byId[canonicalLocalisationId])
													dataNode.byId[canonicalLocalisationId] = {};

												dataNode.byId[canonicalLocalisationId][language] = yamlDataNode.data[language][localisationId];
												if (canonicalLocalisationId != localisationId)
												{
													if (!dataNode.byId[localisationId])
														dataNode.byId[localisationId] = {};
													dataNode.byId[localisationId][language] = yamlDataNode.data[language][localisationId];
												}

												if (!dataNode.byLanguage[language])
													dataNode.byLanguage[language] = {};

												dataNode.byLanguage[language][canonicalLocalisationId] = yamlDataNode.data[language][localisationId];
												dataNode.byLanguage[language][localisationId] = yamlDataNode.data[language][localisationId];

												if (dataNode.languages.indexOf(language) == -1)
													dataNode.languages.push(language);
											}
										}
									}
								}
							});
						}.bind(this)(file.path));
					}
					else
					{
						/*
						promises.push(function (path) {

							return this.getCsvDataByPath(path).then(function (csvDataNode) {
								dataNode.byFile[path] = yamlDataNode;
								dataNode.sourceDataNodes.push(yamlDataNode);
								var language;
								var localisationId;
								for (language in yamlDataNode.data)
								{
									if (yamlDataNode.data.hasOwnProperty(language))
									{
										for (localisationId in yamlDataNode.data[language])
										{
											if (yamlDataNode.data[language].hasOwnProperty(localisationId))
											{
												if (!dataNode.byId[localisationId])
													dataNode.byId[localisationId] = {};

												dataNode.byId[localisationId][language] = yamlDataNode;

												if (!dataNode.byLanguage[language])
													dataNode.byLanguage[language] = {};

												dataNode.byLanguage[language][localisationId] = yamlDataNode;

												if (dataNode.languages.indexOf(language) == -1)
													dataNode.languages.push(language);
											}
										}
									}
								}
							});
						}.bind(this)(file.path));
						*/
					}
				}

				return $q.all(promises).then(
					function (results) {
						return dataNode;
					}
				);
			}.bind(this));
		},
		'linkLocalisation': function (dataNode) {
			if (this.data.history.provinces.byId.length)
			{
				angular.forEach(this.data.history.provinces.byId, function (province, provinceId) {
					if (dataNode.byId['PROV'+ provinceId])
					{
						province._localisation = dataNode.byId['PROV'+ provinceId];
					}
				});
			}
			if (this.data.countries.tags.lastGenerated)
			{
				angular.forEach(this.data.countries.tags.byTag, function (tag) {
					if (dataNode.byId[tag.name])
					{
						tag._localisation = dataNode.byId[tag.name];
					}
				});
			}
		},
		'getProvinceByArea': function (area) {
			if (!area)
				return $q.when(null);
			return this.getData(this.data.map.provinceMapping).then(function (mapping) {
				return this.getData(this.data.history.provinces).then(function (provinces) {
					var provinceId = mapping.areaByProvinceId.indexOf(area);

					if (provinceId == -1 || !provinces.byId[provinceId])
						return null
					else
						return provinces.byId[provinceId];
				}.bind(this));
			}.bind(this));
		},
		'getCountryByTag': function (tag) {
			return this.getData(this.data.countries.tags).then(function (tags) {
				return this.getData(this.data.countries.info).then(function (countries) {

					var countryFile = tags.byTag[tag].value;

					if (countryFile && countries.byPath['common/'+ countryFile])
						return countries.byPath['common/'+ countryFile];
					else
						return null;

				}.bind(this));
			}.bind(this));
		},
		fileExists: function (path) {
			return this.getFileEntry(path).then(function () {
				return true;
			}, function () {
				return false;
			});
		},
		getFileText: function (path, encoding) {
			return traceMapAnalysisPromise('readText ('+ path +')', function () {
				return this.getFile(path).then(function (file) {
					var deferred = $q.defer();

					var reader = new FileReader();
					reader.onerror = function (e) {console.log(path);console.log(e);deferred.reject(e);};
					reader.onloadend = function(event) {
						deferred.resolve(reader.result);
					};
					if (encoding == 'utf8')
						reader.readAsText(file)
					else
						reader.readAsText(file, encoding ? encoding : 'cp1252');

					return deferred.promise;
				});
			}.bind(this));
		},
		writeFileText: function (path, text, encoding, overwrite) {

			if (!encoding)
				encoding = 'cp1252';

			if (encoding != 'utf-8')
				return this.writeFileBuffer(path, this.convertUtf8ToBuffer(text, encoding), overwrite);

			return this.writeFileBlob(path, new Blob([text], {type: 'text/plain'}), overwrite);
		},
		writeFileBuffer: function (path, buffer, overwrite) {
			return this.writeFileBlob(path,  new Blob([buffer]), overwrite);
		},
		writeFileBlob: function (path, blob, overwrite) {
			return fileSystemAdapter.writeFile(path, blob, overwrite).catch(function (error) {
				if (error && error.code == 'permission-prompt')
					this.data.mod.shouldRequestAccess = true;
				return $q.reject(error);
			}.bind(this));
		},
		getFileBuffer: function (path, encoding) {
			return this.getFile(path).then(function (file) {
				var deferred = $q.defer();

				var reader = new FileReader();
				reader.onerror = deferred.reject;
				reader.onloadend = function(event) {
					deferred.resolve(reader.result);
				};
				reader.readAsArrayBuffer(file);

				return deferred.promise;
			});
		},
		// for directories, read the contents of the top-level directory (ignore sub-dirs)
		// and put the results into the textarea, then disable the Save As button
		readDir: function (entry) {
			if (entry.kind != 'directory')
				return $q.when([]);
			return fileSystemAdapter.listDirectory(entry.path);
		},
	};
	$rootScope.modService = modServiceInstance;

	return modServiceInstance;
}]);
