var fileSystemAdapterModule = angular.module('fileSystemAdapter', []);

fileSystemAdapterModule.factory('fileSystemAdapter', ['$q', function ($q) {
	var databasePromise = null;
	var activeProject = null;
	var sourceFiles = new Map();
	var manifestByPath = new Map();
	var modifiedFiles = new Map();
	var databaseName = 'JoroDoxVirtualFiles';
	var databaseVersion = 1;

	function openDatabase() {
		if (!databasePromise) {
			databasePromise = $q(function (resolve, reject) {
				var request = indexedDB.open(databaseName, databaseVersion);
				request.onupgradeneeded = function (event) {
					var database = event.target.result;
					if (!database.objectStoreNames.contains('projects'))
						database.createObjectStore('projects', {keyPath: 'id'});
					if (!database.objectStoreNames.contains('modifiedFiles')) {
						var store = database.createObjectStore('modifiedFiles', {keyPath: 'id'});
						store.createIndex('projectId', 'projectId', {unique: false});
					}
				};
				request.onsuccess = function () { resolve(request.result); };
				request.onerror = function () { reject(request.error); };
			});
		}
		return databasePromise;
	}

	function transact(storeName, mode, callback) {
		return openDatabase().then(function (database) {
			return $q(function (resolve, reject) {
				var transaction = database.transaction([storeName], mode);
				var result;
				function setResult(value) { result = value; }
				transaction.oncomplete = function () { resolve(result); };
				transaction.onerror = function () { reject(transaction.error); };
				transaction.onabort = function () { reject(transaction.error || new Error('IndexedDB transaction aborted.')); };
				try {
					result = callback(transaction.objectStore(storeName), transaction, setResult);
				} catch (error) {
					transaction.abort();
					reject(error);
				}
			});
		});
	}

	function uniqueId() {
		var bytes = new Uint8Array(16);
		window.crypto.getRandomValues(bytes);
		return Array.prototype.map.call(bytes, function (value) {
			return ('0' + value.toString(16)).slice(-2);
		}).join('');
	}

	function normalizedPath(path) {
		var rawPath = String(path || '').replace(/\\/g, '/');
		if (rawPath.charAt(0) == '/' || /^[A-Za-z]:\//.test(rawPath))
			throw new Error('Invalid mod path: absolute paths are not allowed.');
		var parts = rawPath.split('/');
		var normalized = [];
		parts.forEach(function (part) {
			if (!part || part == '.')
				return;
			if (part == '..')
				throw new Error('Invalid mod path: parent traversal is not allowed.');
			normalized.push(part);
		});
		return normalized.join('/');
	}

	function isGitMetadataPath(path) {
		return normalizedPath(path).split('/').indexOf('.git') != -1;
	}

	function descriptor(path, kind, name, lastModified, size) {
		return {
			path: path,
			name: name,
			kind: kind,
			lastModified: lastModified || 0,
			size: size || 0
		};
	}

	function addManifestPath(entries, path, kind, name, lastModified, size) {
		var normalized = normalizedPath(path);
		entries.set(normalized, descriptor(normalized, kind, name, lastModified, size));
	}

	function buildDirectoryManifest(files) {
		if (!files.length)
			throw new Error('The selected directory contains no files.');

		var entries = new Map();
		var fileMap = new Map();
		var firstRelativePath = files[0].webkitRelativePath || files[0].name;
		var firstParts = firstRelativePath.split('/').filter(Boolean);
		var rootName = firstParts.length > 1 ? firstParts[0] : files[0].name;

		files.forEach(function (file) {
			var relativePath = file.webkitRelativePath || file.name;
			var parts = relativePath.split('/').filter(Boolean);
			if (rootName && parts[0] == rootName)
				parts.shift();

			if (parts.indexOf('.git') != -1)
				return;

			var path = normalizedPath(parts.join('/'));
			if (!path)
				path = normalizedPath(file.name);

			addManifestPath(entries, '', 'directory', rootName);
			var parentPath = '';
			var pathParts = path.split('/');
			for (var i = 0; i < pathParts.length - 1; i++) {
				parentPath = parentPath ? parentPath + '/' + pathParts[i] : pathParts[i];
				if (entries.has(parentPath) && entries.get(parentPath).kind != 'directory')
					throw new Error('The imported mod contains a file/directory path conflict: ' + parentPath);
				if (!entries.has(parentPath))
					addManifestPath(entries, parentPath, 'directory', pathParts[i]);
			}

			if (entries.has(path))
				throw new Error('The imported mod contains a file/directory path conflict: ' + path);
			addManifestPath(entries, path, 'file', pathParts[pathParts.length - 1], file.lastModified, file.size);
			fileMap.set(path, file);
		});

		if (!fileMap.size)
			throw new Error('The selected directory contains no importable mod files.');

		return {
			rootName: rootName,
			manifest: Array.from(entries.values()),
			files: fileMap
		};
	}

	function chooseDirectoryFiles() {
		return $q(function (resolve, reject) {
			var input = document.createElement('input');
			input.type = 'file';
			input.multiple = true;
			input.setAttribute('webkitdirectory', '');
			input.style.display = 'none';
			input.onchange = function () {
				var files = Array.prototype.slice.call(input.files || []);
				input.remove();
				if (files.length)
					resolve(files);
				else
					reject(new Error('No directory files were selected.'));
			};
			input.oncancel = function () {
				input.remove();
				var error = new Error('Directory selection was canceled.');
				error.name = 'AbortError';
				reject(error);
			};
			document.body.appendChild(input);
			input.click();
		});
	}

	function loadProjectRecord(projectId) {
		return transact('projects', 'readonly', function (store, transaction, setResult) {
			store.get(projectId).onsuccess = function (event) { setResult(event.target.result); };
		});
	}

	function saveProjectRecord(record) {
		return transact('projects', 'readwrite', function (store) {
			store.put(record);
		});
	}

	function loadModifiedFiles(projectId) {
		return transact('modifiedFiles', 'readonly', function (store, transaction, setResult) {
			var result = [];
			setResult(result);
			var request = store.index('projectId').openCursor(IDBKeyRange.only(projectId));
			request.onsuccess = function (event) {
				var cursor = event.target.result;
				if (cursor) {
					result.push(cursor.value);
					cursor.continue();
				}
			};
			return result;
		});
	}

	function getModifiedFile(projectId, path) {
		return transact('modifiedFiles', 'readonly', function (store, transaction, setResult) {
			store.get(projectId + '\n' + path).onsuccess = function (event) { setResult(event.target.result); };
		});
	}

	function putModifiedFile(projectId, path, blob, kind) {
		return transact('modifiedFiles', 'readwrite', function (store) {
			store.put({
				id: projectId + '\n' + path,
				projectId: projectId,
				path: path,
				kind: kind || 'file',
				blob: blob,
				lastModified: Date.now(),
				size: blob.size
			});
		});
	}

	function getChromeDirectory(path) {
		var parts = normalizedPath(path).split('/').filter(Boolean);
		var directory = activeProject.rootHandle;
		var chain = $q.when(directory);
		parts.forEach(function (part) {
			chain = chain.then(function (current) {
				return current.getDirectoryHandle(part);
			});
		});
		return chain;
	}

	function getChromeEntry(path, expectedKind, create) {
		var normalized = normalizedPath(path);
		if (!normalized)
			return $q.when(descriptor('', 'directory', activeProject.rootName));

		var parts = normalized.split('/');
		var name = parts.pop();
		var parentPath = parts.join('/');
		return getChromeDirectory(parentPath).then(function (parent) {
			if (expectedKind == 'directory')
				return parent.getDirectoryHandle(name, create ? {create: true} : undefined).then(function (handle) {
					return descriptor(normalized, 'directory', handle.name);
				});
			return parent.getFileHandle(name, create ? {create: true} : undefined).then(function (handle) {
				return handle.getFile().then(function (file) {
					return descriptor(normalized, 'file', handle.name, file.lastModified, file.size);
				});
			});
		});
	}

	function toProjectInfo(record, manifest) {
		return {
			id: record.id,
			backend: record.backend,
			rootName: record.rootName,
			manifest: manifest || [],
			sourceAttached: record.backend == 'chrome' || !!activeProject.sourceFiles
		};
	}

	function indexModifiedFile(item) {
		var parts = item.path.split('/');
		var name = parts.pop();
		var parentPath = '';
		parts.forEach(function (part) {
			parentPath = parentPath ? parentPath + '/' + part : part;
			if (!manifestByPath.has(parentPath))
				manifestByPath.set(parentPath, descriptor(parentPath, 'directory', part));
		});
		manifestByPath.set(item.path, descriptor(item.path, item.kind, name, item.lastModified, item.size));
	}

	function activateVirtualProject(record, manifest, files) {
		activeProject = {
			id: record.id,
			backend: 'virtual',
			rootName: record.rootName,
			persistChanges: true,
			sourceFiles: files || null
		};
		manifestByPath = new Map();
		(manifest || []).forEach(function (entry) {
			var path = normalizedPath(entry.path);
			manifestByPath.set(path, descriptor(path, entry.kind, entry.name, entry.lastModified, entry.size));
		});
		sourceFiles = files || new Map();
		modifiedFiles = new Map();
		return loadModifiedFiles(record.id).then(function (records) {
			records.forEach(function (item) { modifiedFiles.set(item.path, item); });
			modifiedFiles.forEach(indexModifiedFile);
			return toProjectInfo(record, Array.from(manifestByPath.values()));
		});
	}

	function selectDirectoryProject() {
		if (typeof window.showDirectoryPicker == 'function') {
			return window.showDirectoryPicker({mode: 'readwrite'}).then(function (rootHandle) {
				var record = {
					id: uniqueId(),
					backend: 'chrome',
					rootName: rootHandle.name,
					rootHandle: rootHandle
				};
				activeProject = record;
				return saveProjectRecord(record).then(function () {
					return toProjectInfo(record);
				});
			});
		}

		return chooseDirectoryFiles().then(function (files) {
			var imported = buildDirectoryManifest(files);
			var record = {id: uniqueId(), backend: 'virtual', rootName: imported.rootName};
			return saveProjectRecord(record).then(function () {
				return activateVirtualProject(record, imported.manifest, imported.files);
			});
		});
	}

	function sourceMatches(expectedManifest, importedManifest) {
		var expectedFiles = (expectedManifest || []).filter(function (entry) {
			return entry.kind == 'file' && !isGitMetadataPath(entry.path);
		});
		var actualFiles = importedManifest.filter(function (entry) {
			return entry.kind == 'file' && !isGitMetadataPath(entry.path);
		});
		if (expectedFiles.length != actualFiles.length)
			return false;
		var actualByPath = new Map(actualFiles.map(function (entry) { return [entry.path, entry]; }));
		return expectedFiles.every(function (entry) {
			var actual = actualByPath.get(normalizedPath(entry.path));
			if (!actual || actual.size != entry.size)
				return false;
			return !entry.lastModified || !actual.lastModified || actual.lastModified == entry.lastModified;
		});
	}

	function ensureAccess(requestIfNeeded) {
		if (!activeProject)
			return $q.reject(new Error('No mod project is open.'));
		if (activeProject.backend == 'virtual') {
			if (!activeProject.sourceFiles)
				return $q.reject(new Error('Re-select the source directory to access unchanged files.'));
			return $q.when();
		}

		var handle = activeProject.rootHandle;
		return handle.queryPermission({mode: 'readwrite'}).then(function (state) {
			if (state == 'granted')
				return;
			if (state == 'denied')
				return $q.reject(new Error('Directory access was denied.'));
			if (!requestIfNeeded)
			{
				var permissionError = new Error('Directory access must be enabled.');
				permissionError.code = 'permission-prompt';
				return $q.reject(permissionError);
			}
			return handle.requestPermission({mode: 'readwrite'}).then(function (result) {
				if (result != 'granted')
					return $q.reject(new Error('Directory access was not granted.'));
			});
		});
	}

	function listDirectory(path) {
		var normalized = normalizedPath(path);
		if (!activeProject)
			return $q.reject(new Error('No mod project is open.'));
		if (activeProject.backend == 'chrome') {
			return ensureAccess(false).then(function () {
				return getChromeDirectory(normalized).then(function (directory) {
					var entries = [];
					return (async function () {
						for await (var pair of directory.entries()) {
							var child = pair[1];
							var childPath = normalized ? normalized + '/' + child.name : child.name;
							entries.push(descriptor(childPath, child.kind, child.name));
						}
						return entries;
					})();
				});
			});
		}
		var prefix = normalized ? normalized + '/' : '';
		var children = new Map();
		manifestByPath.forEach(function (entry, entryPath) {
			if (!entryPath || entryPath.indexOf(prefix) != 0)
				return;
			var remainder = entryPath.substring(prefix.length);
			if (!remainder)
				return;
			var slashIndex = remainder.indexOf('/');
			if (slashIndex == -1)
				children.set(remainder, entry);
			else {
				var name = remainder.substring(0, slashIndex);
				var childPath = prefix + name;
				if (!children.has(name))
					children.set(name, descriptor(childPath, 'directory', name));
			}
		});
		return $q.when(Array.from(children.values()));
	}

	return {
		selectProject: selectDirectoryProject,
		restoreProject: function (projectId, adapterState, manifest) {
			return loadProjectRecord(projectId).then(function (record) {
				var legacyRootHandle = adapterState && adapterState.retainedRootFileEntry;
				if (!record && legacyRootHandle) {
					record = {
						id: projectId || uniqueId(),
						backend: 'chrome',
						rootName: legacyRootHandle.name,
						rootHandle: legacyRootHandle
					};
					return saveProjectRecord(record).then(function () { return record; });
				}
				if (!record && adapterState && adapterState.rootHandle) {
					record = {
						id: projectId || uniqueId(),
						backend: 'chrome',
						rootName: adapterState.rootName,
						rootHandle: adapterState.rootHandle
					};
					return saveProjectRecord(record).then(function () { return record; });
				}
				return record;
			}).then(function (record) {
				if (!record)
					return $q.reject(new Error('The saved mod filesystem record is missing.'));
				if (record.backend == 'chrome') {
					activeProject = record;
					return toProjectInfo(record);
				}
				return activateVirtualProject(record, manifest, null);
			});
		},
		attachSource: function (projectId, expectedManifest) {
			return loadProjectRecord(projectId).then(function (record) {
				if (!record || record.backend != 'virtual')
					return $q.reject(new Error('This project does not use an imported source directory.'));
				return chooseDirectoryFiles().then(function (files) {
					var imported = buildDirectoryManifest(files);
					if (!sourceMatches(expectedManifest, imported.manifest) &&
						!window.confirm('The selected directory does not exactly match the saved mod. Reattach it and apply the saved file changes anyway?')) {
						var canceled = new Error('The selected directory was not attached.');
						canceled.name = 'AbortError';
						return $q.reject(canceled);
					}
					return activateVirtualProject(record, imported.manifest, imported.files);
				});
			});
		},
		isVirtualProject: function () {
			return !!activeProject && activeProject.backend == 'virtual';
		},
		needsSource: function () {
			return !!activeProject && activeProject.backend == 'virtual' && !activeProject.sourceFiles;
		},
		ensureAccess: ensureAccess,
		getEntry: function (path, expectedKind) {
			var normalized = normalizedPath(path);
			if (!activeProject)
				return $q.reject(new Error('No mod project is open.'));
			if (activeProject.backend == 'chrome')
				return ensureAccess(false).then(function () {
					if (expectedKind)
						return getChromeEntry(normalized, expectedKind, false);
					return getChromeEntry(normalized, 'file', false).catch(function (error) {
						if (error.name != 'NotFoundError' && error.name != 'TypeMismatchError')
							return $q.reject(error);
						return getChromeEntry(normalized, 'directory', false);
					});
				});
			var entry = manifestByPath.get(normalized);
			if (entry)
				return $q.when(entry);
			return getModifiedFile(activeProject.id, normalized).then(function (modified) {
				if (modified)
					return descriptor(normalized, modified.kind, normalized.split('/').pop(), modified.lastModified, modified.size);
				var error = new Error('File or directory was not found: ' + normalized);
				error.name = 'NotFoundError';
				return $q.reject(error);
			});
		},
		listDirectory: listDirectory,
			getFileList: function () {
				return ensureAccess(false).then(function () {
					if (activeProject.backend == 'virtual')
						return Array.from(manifestByPath.values()).filter(function (entry) {
							return entry.kind == 'file' && !isGitMetadataPath(entry.path);
						});
					var files = [];
					function visit(path) {
						return listDirectory(path).then(function (entries) {
							return $q.all(entries.map(function (entry) {
								if (isGitMetadataPath(entry.path))
									return;
								if (entry.kind == 'directory')
									return visit(entry.path);
								files.push(entry);
							}));
						});
					}
					return visit('').then(function () { return files; });
				});
			},
		readFile: function (path) {
			var normalized = normalizedPath(path);
			if (!activeProject)
				return $q.reject(new Error('No mod project is open.'));
			if (activeProject.backend == 'chrome')
				return ensureAccess().then(function () {
					var parts = normalized.split('/');
					var name = parts.pop();
					return getChromeDirectory(parts.join('/')).then(function (directory) {
						return directory.getFileHandle(name).then(function (handle) { return handle.getFile(); });
					});
				});
			var cachedChange = modifiedFiles.get(normalized);
			if (cachedChange)
				return $q.when(cachedChange.blob);
			return getModifiedFile(activeProject.id, normalized).then(function (modified) {
				if (modified)
					return modified.blob;
				if (!activeProject.sourceFiles)
					return $q.reject(new Error('Re-select the source directory to access unchanged files.'));
				var file = sourceFiles.get(normalized);
				return file ? file : $q.reject(new Error('File was not found: ' + normalized));
			});
		},
		writeFile: function (path, blob, overwrite) {
			var normalized = normalizedPath(path);
			if (!activeProject)
				return $q.reject(new Error('No mod project is open.'));
			if (activeProject.backend == 'chrome') {
				return ensureAccess().then(function () {
					var existing = getChromeEntry(normalized, 'file', false);
					return existing.then(function () {
						if (!overwrite)
							return false;
						return writeChromeFile(normalized, blob);
					}, function (error) {
						if (error.name != 'NotFoundError')
							return $q.reject(error);
						return writeChromeFile(normalized, blob);
					});
				});
			}
			var exists = manifestByPath.has(normalized) || modifiedFiles.has(normalized);
			if (exists && !overwrite)
				return $q.when(false);
			var saveChange = activeProject.persistChanges === false
				? $q.when()
				: putModifiedFile(activeProject.id, normalized, blob, 'file');
			return saveChange.then(function () {
				var item = {
					path: normalized,
					kind: 'file',
					blob: blob,
					lastModified: Date.now(),
					size: blob.size
				};
				indexModifiedFile(item);
				modifiedFiles.set(normalized, item);
				return true;
			});
		},
		deleteProject: function (projectId) {
			return openDatabase().then(function (database) {
				return $q(function (resolve, reject) {
					var transaction = database.transaction(['projects', 'modifiedFiles'], 'readwrite');
					transaction.objectStore('projects').delete(projectId);
					var cursorRequest = transaction.objectStore('modifiedFiles').index('projectId').openCursor(IDBKeyRange.only(projectId));
					cursorRequest.onsuccess = function (event) {
						var cursor = event.target.result;
						if (cursor) {
							cursor.delete();
							cursor.continue();
						}
					};
					transaction.oncomplete = function () {
						if (activeProject && activeProject.id == projectId) {
							activeProject.persistChanges = false;
						}
						resolve();
					};
					transaction.onerror = function () { reject(transaction.error); };
				});
			});
		},
		getProjectId: function () { return activeProject && activeProject.id; },
		getManifest: function () { return Array.from(manifestByPath.values()); }
	};

	function writeChromeFile(path, blob) {
		var parts = normalizedPath(path).split('/');
		var name = parts.pop();
		return getChromeDirectory(parts.join('/')).then(function (directory) {
			return directory.getFileHandle(name, {create: true}).then(function (handle) {
				return handle.createWritable().then(function (writer) {
					return writer.write(blob).then(function () {
						return writer.close().then(function () { return true; });
					});
				});
			});
		});
	}
}]);
