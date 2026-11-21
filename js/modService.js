var module = angular.module('modService', ['mapAnalyzeService', 'fileSystemAdapter']);

// A service representing a Mod

module.factory('modService', ['$rootScope', '$timeout', '$modal', '$q', 'mapAnalyzeService', 'pdxScriptService', 'fileSystemAdapter', function($rootScope, $timeout, $modal, $q, mapAnalyzeService, pdxScriptService, fileSystemAdapter) {

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
					sourceFiles: [
						'map/default.map',
						'map/climate.txt',
						'map/continent.txt',
						'map/region.txt',
						'map/seasons.txt',
						'map/terrain.txt',
						//'map/trade_winds.txt',
					],
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
			if (!dataNode)
				console.log('Unknown datanode!');

			// Is already generating... wait for that
			if ('generatePromise' in dataNode && dataNode.generatePromise)
				return dataNode.generatePromise;

			if (this.isNodeOutdatedQuick(dataNode))
			{
				dataNode.generatePromise = this.generateData(dataNode);

				dataNode.generatePromise.then(function() {
					dataNode.generatePromise = null;
				});

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
				return this.loadDependencies(dataNode).then(function () {
					this.loadingState[dataNode.generateMethod] = true;

					return this[dataNode.generateMethod](dataNode);
				}.bind(this)).then(function () {
					dataNode.lastGenerated = new Date();

					if (this[dataNode.generateMethod.replace('generate', 'link')])
						this[dataNode.generateMethod.replace('generate', 'link')](dataNode);

					this.loadingState[dataNode.generateMethod] = false;

					return dataNode;
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
					promises.push(this.getFileNodeByPath(sourceFile));
				}, this);
			}

			return $q.all(promises).then(function () {
				return dataNode;
			});
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
			return fileSystemAdapter.getEntry(path, expectedKind).catch(function (error) {
				if (error && error.code == 'permission-prompt')
					this.data.mod.shouldRequestAccess = true;
				if (ignoreExist && (error.name == 'NotFoundError' || error.name == 'InvalidModificationError'))
					return false;
				return $q.reject(error);
			}.bind(this));
		},
		getFile: function (path, options) {
			return fileSystemAdapter.readFile(path).catch(function (error) {
				if (error && error.code == 'permission-prompt')
					this.data.mod.shouldRequestAccess = true;
				return $q.reject(error);
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
			return this.getFileNodeByPath(dataNode.sourceFiles[0]).then(function (node) {
				return this.loadFileNodeDirectory(node);
			}.bind(this)).then(function (node) {
				var promises = [];
				var idRegex = /^([0-9]+)\s*.*\.txt$/i;
				dataNode.sourceDataNodes = [];
				dataNode.byId.length = 0;
				dataNode.provinceIds.length = 0;
				for (var i = 0; i < node.files.length; i++)
				{
					var file = node.files[i];

					var matches = idRegex.exec(file.name);

					if (!matches)
					{
						console.log(file.path +' not a province history file.')
						continue;
					}
					var id = parseInt(matches[1]);

					promises.push(function (path, id) {
						return this.getPdxScriptDataByPath(path).then(function (pdxDataNode) {
							dataNode.byId[id] = pdxDataNode;
							pdxDataNode._id = id;
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

				return $q.all(promises).then(
					function (results) {
						return dataNode;
					}.bind(this)
				);
			}.bind(this));
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
				if (this.data.history.provinces.lastGenerated && country._tag)
				{
					angular.forEach(country._ownedProvinces, function (province) {
						province._country = null;
					});
					country._ownedProvinces = [];
					angular.forEach(this.data.history.provinces.byId, function (province) {
						if (province.data.data.owner == country._tag.name)
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
			var promises = [];
			for (var i = 0; i < dataNode.sourceFiles.length; i++)
			{
				promises.push(this.getPdxScriptDataByPath(dataNode.sourceFiles[i]).then(function (pdxNode) {
					dataNode[pdxNode.file.baseName] = pdxNode.data;
					dataNode.nodesByName[pdxNode.file.baseName] = pdxNode;
					dataNode.byPath[pdxNode.file.path] = pdxNode;
				}));
			}
			return $q.all(promises).then(function () {
				return dataNode;
			}.bind(this));
		},
		'saveMapEnvironment':  function (dataNode) {
			var promises = [];

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

						promises.push(this.saveData(value._node));
					}
					else if (value._type == 'namedSet' || value._type == 'multipleNamed')
					{
						angular.forEach(value._nodeByName, function (node) {
							if ('_provinces' in node)
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

						promises.push(this.saveData(value._node));
					}
				}
			}.bind(this));

			return $q.all(promises).then(function () {
				return dataNode;
			}.bind(this));
		},
		'linkMapEnvironment': function (dataNode) {
			this.data.history.provinces._environment = dataNode;

			// Connect things
			if (this.data.history.provinces.lastGenerated && dataNode.default.data.sea_starts)
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
			if (this.data.history.provinces.lastGenerated && dataNode.default.data.lakes)
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
			if (this.data.history.provinces.lastGenerated && dataNode.default.data.force_coastal)
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
			if (this.data.history.provinces.lastGenerated && dataNode.climate)
			{
				dataNode._climate = dataNode.climate;
				dataNode.climate._type = 'namedSet';
				dataNode.climate._node = dataNode.nodesByName.climate;
				dataNode._climate._nodeByName = {};

				angular.forEach(dataNode.climate.subNodes, function (climate) {
					climate._provinces = [];
					climate._node = dataNode.climate._node;
					dataNode._climate._nodeByName[climate.name] = climate;
					climate._type = 'namedSet';

					angular.forEach(climate.value, function (provinceId) {
						if (this.data.history.provinces.byId[provinceId])
						{
							var province = this.data.history.provinces.byId[provinceId];

							province._climate = climate;
							if (climate._provinces.indexOf(province) == -1)
								climate._provinces.push(province);
						}
					}.bind(this));
				}.bind(this));
			}
			if (this.data.history.provinces.lastGenerated && dataNode.continent)
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
			if (this.data.history.provinces.lastGenerated && dataNode.region)
			{
				dataNode._regions = dataNode.region;
				dataNode.region._type = 'multipleNamed';
				dataNode.region._node = dataNode.nodesByName.region;
				dataNode._regions._nodeByName = {};

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

				angular.forEach(dataNode.region.subNodes, function (region) {
					region._provinces = [];
					region._node = dataNode.region._node;
					dataNode._regions._nodeByName[region.name] = region;

					angular.forEach(region.value, function (provinceId) {
						if (this.data.history.provinces.byId[provinceId])
						{
							var province = this.data.history.provinces.byId[provinceId];

							if (province._regions.indexOf(province) == -1)
								province._regions.push(region);

							if (region._provinces.indexOf(province) == -1)
								region._provinces.push(province);
						}
					}.bind(this));
				}.bind(this));
			}
		},
		'getPdxScriptDataByPath': function (path) {
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
		},
		'savePdxScriptData': function (dataNode) {
			var pdxScriptText = pdxScriptService.writeData(dataNode.data.data);

			return this.writeFileText(dataNode.file.path, pdxScriptText, 'cp1252', true).then(function () {
				return this.getMetadata(dataNode.file);
			}.bind(this));
		},
		'generateYamlData': function (dataNode) {
			dataNode.data = null;
			return this.getFileText(dataNode.sourceFiles[0]).then(function (text) {

				// Prefix BOM if not present (EU4 has some 'broken' files)
				if (text[0] != '\xEF')
				{
					//text = '\xEF\xBB\xBF' + text;
				}

				try
				{
					dataNode.data = jsyaml.safeLoad(text);
				}
				catch (e)
				{
					console.log(e);
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
			var yamlText = jsyaml.dump(this.convertToPlainData(dataNode.data));

			return this.writeFileText(dataNode.file.path, yamlText, 'utf-8', true).then(function () {
				return this.getMetadata(dataNode.file);
			}.bind(this));;
		},
		'generateMapImage': function (dataNode) {
			return this.getFile(dataNode.sourceFiles[0]).then(function (file) {
				dataNode.imageBlob = file;
				return dataNode;
			});
		},
		'generateMapInfo': function (dataNode) {
			return this.getData(this.data.map[dataNode.mapSource].image).then(function (imageNode) {
				return this.getImage(imageNode);
			}.bind(this)).then(function (image) {
				dataNode.analytics = mapAnalyzeService.analyzeColorMap(image);
				return dataNode;
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
		},
		'generateMapColorMapping': function (dataNode) {
			return this.getFileText('map/definition.csv').then(function (text) {
				dataNode.byId = [];
				dataNode.byColor = [];

				for (line of text.split("\n"))
				{
					var fields = line.split(';');

					if (fields[0] == 'province')
						continue;

					var mapping = {
						id: fields[0],
						r: fields[1],
						g: fields[2],
						b: fields[3],
						colorNum: parseInt(fields[1]) << 16 | parseInt(fields[2]) << 8 | parseInt(fields[3]),
						name: fields[4] + '',
						center: null,
					};
					if (fields[5] && fields[5].indexOf(',') > -1)
					{
						mapping.center = [
							parseFloat(fields[5].split(',')[0]),
							parseFloat(fields[5].split(',')[1])
						];
					}

					dataNode.byId[mapping.id] = mapping;

					if (!dataNode.byColor[mapping.colorNum])
						dataNode.byColor[mapping.colorNum] = mapping;
				}

				return dataNode;
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
					for (var i = 0; i < mappings.byId.length; i++)
					{
						if (mappings.byId[i] && mapInfo.analytics.colors[mappings.byId[i].colorNum])
						{
							dataNode.areaByProvinceId[i] = mapInfo.analytics.colors[mappings.byId[i].colorNum];
						}
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
												yamlDataNode.data[language][localisationId] = new String(yamlDataNode.data[language][localisationId]);

												yamlDataNode.data[language][localisationId]._text = yamlDataNode.data[language][localisationId].toString();
												yamlDataNode.data[language][localisationId]._node = yamlDataNode;

												if (!dataNode.byId[localisationId])
													dataNode.byId[localisationId] = {};

												dataNode.byId[localisationId][language] = yamlDataNode.data[language][localisationId];

												if (!dataNode.byLanguage[language])
													dataNode.byLanguage[language] = {};

												dataNode.byLanguage[language][localisationId] = yamlDataNode.data[language][localisationId];;

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
			if (this.data.history.provinces.lastGenerated)
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
