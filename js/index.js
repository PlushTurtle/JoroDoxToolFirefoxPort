var myMod = angular.module('JoroDox', [
	'ui.bootstrap', 'ui.router', 'ui.layout', 'ui.tree',
	'panzoom', 'panzoomwidget', 'cfp.hotkeys',
	'modService', 'mapAnalyzeService', 'mapDrawService', 'pdxDataService', 'pdxScriptService', 'rendererService',
	'digestDiagnostics'
]);

myMod.run(['$rootScope', 'digestDiagnostics', function ($rootScope, digestDiagnostics) {
	digestDiagnostics.install($rootScope);
}]);

myMod.filter('commentFilter', function() {
	return function(input) {
		var txt = [];
		for (key in input)
		{
			if (input.hasOwnProperty(key) && input[key] != null)
			{
				txt.push(input[key]);
			}
		}

		return txt;
	};
});

myMod.filter('collapseFilter', function() {
	return function(input, collapsed) {
		if (collapsed)
			return [];
		else
			return input;
	};
});

myMod.filter('jsonFiltered', function() {
	return function(data, removeList, spacing) {
		return JSON.stringify(data, function (key, value) {
			if (removeList.indexOf(key) != -1 || key == '$$hashKey')
				return undefined;
			else
				return value;
		}, spacing);
	};
});

// Error window
myMod.controller('ErrorModal', function ($scope, $modalInstance, error) {

	$scope.error = error;

	$scope.ok = function () {
		$modalInstance.close();
	};
});


//Message window
myMod.controller('MessageModal', function ($scope, $modalInstance, message, resolve) {

	$scope.message = message;

	$scope.ok = function () {
		$modalInstance.close();
		resolve(true);
	};
});

// Router
myMod.config(['$stateProvider', function ($stateProvider) {
	$stateProvider.state({
		name: 'settings',
		url: '/settings',
		templateUrl: 'content.settings.html',
	});
	$stateProvider.state({
		name: 'about',
		url: '/about',
		templateUrl: 'content.about.html'
	});
	$stateProvider.state({
		name: 'inspect',
		url: '/inspect',
		templateUrl: 'content.inspect.html'
	});
	$stateProvider.state({
		name: 'inspect.file',
		templateUrl: 'content.inspect.file.html',
		url: '/inspect/:path/:animationPath',
		controller: 'FileInspect',
		resolve: {
			node: function ($stateParams, modService) {
				return modService.data.fileSystem.byPath[$stateParams.path];
			},
			animation: function ($stateParams, modService) {
				if ($stateParams.animationPath)
					return modService.data.fileSystem.byPath[$stateParams.animationPath];
				else
					return null;
			}
		}
	});
	$stateProvider.state({
		name: 'inspect.map',
		templateUrl: 'content.inspect.map.html',
		url: '/inspect/map',
	});
	$stateProvider.state({
		name: 'inspect.provincesHistory',
		templateUrl: 'content.inspect.provincesHistory.html',
		url: '/inspect/history/provinces',
	});
	$stateProvider.state({
		name: 'inspect.countriesHistory',
		templateUrl: 'content.inspect.countriesHistory.html',
		url: '/inspect/history/countries',
	});
}]).config(['$urlRouterProvider', function ($urlRouterProvider) {
	$urlRouterProvider.otherwise("/inspect")
}]);

// File inspector
myMod.controller('FileInspect', function ($scope, node, animation, modService, pdxDataService, pdxScriptService, $timeout, rendererService, $state, $stateParams, $q) {
	$scope.node = node;
	$scope.loading = true;
	$scope.showJson = false;
	$scope.viewScene = null;
	$scope.image = null;

	var viewScopeDestroyed = false;
	$scope.$on('$destroy', function () {
		viewScopeDestroyed = true;
		if ($scope.viewScene)
		{
			$scope.viewScene.dispose();
			$scope.viewScene = null;
		}
	});

	function createViewScene() {
		if (viewScopeDestroyed)
			return $q.when(null);

		return rendererService.createViewScene(document.getElementById('3dview'), 800, 600).then(function (viewScene) {
			if (viewScopeDestroyed)
			{
				viewScene.dispose();
				return null;
			}

			$scope.viewScene = viewScene;
			return viewScene;
		});
	}

	function isViewSceneActive(viewScene) {
		return !viewScopeDestroyed && viewScene && !viewScene.disposed;
	}

	modService.setCurrent($scope.node);

	$scope.Math = window.Math;

	$scope.pdxShaders = [
   		'PdxMeshStandard',
		'PdxMeshColor',
		'PdxMeshTextureAtlas',
		'PdxMeshSnow',
		'PdxMeshAlphaBlend',
		'PdxMeshAlphaBlendNoZWrite',
		'PdxMeshStandard_NoFoW_NoTI',
		'Collision',
		'JdxMeshShield',
		'JdxMeshShieldTextureAtlas',
	];

	$scope.pdxShaderDescriptions = {
		'PdxMeshStandard': '[EU4 + CK2] The default not-transparent texture shader.',
		'PdxMeshColor': '[EU4 + CK2] Shader which can blend the three \'national\' colors of the units country into the texture via the specular texture.',
		'PdxMeshTextureAtlas': '[EU4 + CK2] Shader which blends the texture with an image of the units country\'s flag.',
		'PdxMeshSnow': '[EU4 only] Shader which will add snow on top facing surfaces, when in a snowy location.',
		'PdxMeshAlphaBlend': '[EU4 only] Shader which will allow transparency via the alpha channel of the diffuse texture.',
		'PdxMeshAlphaBlendNoZWrite': '[EU4 only] A slower transparency shader with less transparency order glitches.',
		'PdxMeshStandard_NoFoW_NoTI': '[EU4 only] Shader for objects which should never be hidden by Fog of War or Terra Incognita.',
		'Collision': '[EU4 + CK2] \'Shader\' which will not render the mesh, but instead use it to check for (input) collision checking. (ie the clickable space of the item)',
		'JdxMeshShield': '[CK2-JoroDox] Model always faces the player, and slightly scaled differently on zoom level. JodoDox CK2 Shader extension required!',
		'JdxMeshShieldTextureAtlas': '[CK2-JoroDox] Custom PdxMeshTextureAtlas shader, which always faces the player, and scaled differently. JodoDox CK2 Shader extension required!',
	};

	modService.getMetadata(node).then(function () {

	});

	if (node.fileType == 'image')
	{
		modService.getFile(node.path).then(function (file) {
			loadImage(file, function (img) {
				$scope.$apply(function() { $scope.image = img; $scope.loading = false; });
			}, {noRevoke: true});
		});
	}
	else if (node.fileType == 'image-tga')
	{
		modService.getFileBuffer(node.path).then(function (buffer) {
			var tga = new TGA();
			tga.load(new Uint8Array(buffer));
			var img = new Image();
			img.src = tga.getDataURL('image/png');
			$scope.image = img;
			$scope.loading = false;
		});
	}
	else if (node.fileType == 'pdx-animation')
	{
		modService.getFileBuffer(node.path).then(function (buffer) {
			$timeout(function () {
				node.treeData = pdxDataService.readFromBuffer(buffer);
				node.treeDataType = 'complex';
				$scope.loading = false;
			});
		});
	}
	else if (node.fileType == 'pdx-mesh')
	{
		$scope.animations = [];
		$scope.meshes = [];
		$scope.meshToRender = [];
		$scope.selectedAnimation = null;
		$scope.textureFiles = [];

		var findAnimations = function (folder) {
			for (var i = 0; i < folder.files.length; i++)
			{
				if (folder.files[i].fileType == 'pdx-animation')
				{
					$scope.animations.push({
						name: folder.files[i].path,
						fps: 0,
						bones: 0,
						duration: 0,
						animation: null,
						node: folder.files[i],
					});
				}
			}
			for (var i = 0; i < folder.folders.length; i++)
				findAnimations(folder.folders[i]);
		};
		findAnimations(node.parent);

		var findTextures = function (folder, basePath) {
			if (!basePath)
				basePath = folder.path +'/';
			for (var i = 0; i < folder.files.length; i++)
			{
				if (folder.files[i].fileType == 'image-dds')
				{
					$scope.textureFiles.push(folder.files[i].path.replace(basePath, ''));
				}
			}
			for (var i = 0; i < folder.folders.length; i++)
				findTextures(folder.folders[i], basePath);
		};
		findTextures(node.parent);

		$scope.$watch('selectedAnimation', function(newValue, oldValue) {
			$scope.loadAnimation(newValue);
		});

		$scope.$watch('meshes', function(newValue, oldValue) {
			for (var i = 0; i < $scope.meshes.length; i++)
			{
				rendererService.updatePdxMesh($scope.meshToRender[i]);
			}
		}, true);

		$scope.loadAnimation = function (animation) {
			if (animation)
			{
				$scope.loading = true;
				modService.getFileBuffer(animation.node.path).then(function (buffer) {
					if (viewScopeDestroyed || !$scope.viewScene || $scope.viewScene.disposed)
						return;

					animation.node.treeData = pdxDataService.readFromBuffer(buffer);
					animation.node.treeDataType = 'complex';
					animation.fps = animation.node.treeData.props.info.props.fps;
					animation.bones = animation.node.treeData.props.info.props.j;
					animation.duration = animation.node.treeData.props.info.props.sa / animation.node.treeData.props.info.props.fps;

					rendererService.setPdxAnimation($scope.viewScene, animation.node.treeData);
					$scope.loading = false;
				});
			}
			else if ($scope.viewScene)
			{
				rendererService.setPdxAnimation($scope.viewScene, null);
			}
		};

		$scope.savePdxMesh = function() {
			var buffer = pdxDataService.writeToBuffer($scope.node.treeData);

			$scope.loading = true;

			return modService.writeFileBuffer($scope.node.path, buffer, true).then(function () {
				$scope.loading = false;
			}).then(function () {
				modService.loadFileNode($scope.node).then(function () {
					$state.go('inspect.file', {path: $scope.node.path, 'node': $scope.node});
					return modService.showMessage({title: 'Changes saved', text: 'Changes saved to `'+  $scope.node.path +'`'});
				});
			});
		};

		modService.getFileBuffer(node.path).then(function (buffer) {
			$timeout(function () {
				node.treeData = pdxDataService.readFromBuffer(buffer);
				node.treeDataType = 'complex';

				if ('object' in node.treeData.props)
				{
					createViewScene().then(function (viewScene) {
						if (!viewScene)
							return;

						rendererService.loadPdxMesh(node.treeData, node.parent.path).then(function (viewObject) {
							if (!isViewSceneActive(viewScene))
								return;

							viewScene.scene.add(viewObject.object);
							rendererService.setViewSceneModelDistance(viewScene, viewObject.distance);
							viewScene.viewConfig.update = viewObject.update;
							viewScene.viewConfig.viewObject = viewObject;

							for (var i = 0; i < viewObject.meshes.length; i++)
							{
								var mesh = viewObject.meshes[i];

								$scope.meshes.push({
									name: mesh.name,
									pdxMaterial: mesh.pdxData.props.material.props,
								});
								$scope.meshToRender[$scope.meshes.length - 1] = mesh;
							}

							if (animation)
							{
								for (var i = 0; i < $scope.animations.length; i++)
									if ($scope.animations[i].node.path == animation.path)
										$scope.selectedAnimation = $scope.animations[i];

								$stateParams.animationPath = null;
							}

							$scope.loading = false;
						});
					});
				}
				else
				{
					$scope.loading = false;
				}
			}, 0);
		});
	}
	else if (node.fileType == 'collada')
	{
		$scope.animations = [];
		$scope.selectedAnimations = [];
		$scope.selectMultipleAnimations = true;

		$scope.$watchCollection('selectedAnimations', function(newValues, oldValues) {
			if ($scope.viewScene && $scope.viewScene.viewConfig.viewObject)
			{
				for (var i = 0; i < oldValues.length; i++)
				{
					oldValues[i].animation.stop();
					oldValues[i].animation.root.pose();
				}
				for (var i = 0; i < newValues.length; i++)
				{
					newValues[i].animation.play();
				}
			}
		});

		$scope.toggleSelectedAnimation = function (animation) {
			var index = $scope.selectedAnimations.indexOf(animation);
			if (index == -1)
				$scope.selectedAnimations.push(animation);
			else
				$scope.selectedAnimations.splice(index, 1);
		};

		createViewScene().then(function (viewScene) {
			if (!viewScene)
				return;

			modService.getFileText(node.path).then(function (text) {
				if (!isViewSceneActive(viewScene))
					return;

				rendererService.loadCollada(text, node.parent.path).then(function (viewObject) {
					if (!isViewSceneActive(viewScene))
						return;

					viewScene.scene.add(viewObject.object);
					rendererService.setViewSceneModelDistance(viewScene, viewObject.distance);
					viewScene.viewConfig.update = viewObject.update;
					viewScene.viewConfig.viewObject = viewObject;

					for (var i = 0; i < viewObject.animations.length; i++)
					{
						var anim = viewObject.animations[i];

						$scope.animations.push({
							name: anim.data.name ? anim.data.name : 'Embedded',
							fps: anim.data.fps,
							bones: anim.data.hierarchy.length,
							duration: anim.data.length,
							animation: anim,
							node: null
						});
					}

					$scope.loading = false;
				});
			});
		});
	}
	else if (node.fileType == 'json')
	{
		$scope.animations = [];
		$scope.selectedAnimations = [];
		$scope.selectMultipleAnimations = true;

		$scope.$watchCollection('selectedAnimations', function(newValues, oldValues) {
			if ($scope.viewScene && $scope.viewScene.viewConfig.viewObject)
			{
				for (var i = 0; i < oldValues.length; i++)
				{
					oldValues[i].animation.stop();
					oldValues[i].animation.root.pose();
				}
				for (var i = 0; i < newValues.length; i++)
				{
					newValues[i].animation.play();
				}
			}
		});

		$scope.toggleSelectedAnimation = function (animation) {
			var index = $scope.selectedAnimations.indexOf(animation);
			if (index == -1)
				$scope.selectedAnimations.push(animation);
			else
				$scope.selectedAnimations.splice(index, 1);
		};

		createViewScene().then(function (viewScene) {
			if (!viewScene)
				return;

			modService.getFileText(node.path).then(function (text) {
				if (!isViewSceneActive(viewScene))
					return;

				rendererService.loadThreeJson(text, node.parent.path).then(function (viewObject) {
					if (!isViewSceneActive(viewScene))
						return;

					viewScene.scene.add(viewObject.object);
					rendererService.setViewSceneModelDistance(viewScene, viewObject.distance);
					viewScene.viewConfig.update = viewObject.update;
					viewScene.viewConfig.viewObject = viewObject;

					for (var i = 0; i < viewObject.animations.length; i++)
					{
						var anim = viewObject.animations[i];

						$scope.animations.push({
							name: anim.data.name ? anim.data.name : 'Embedded',
							fps: anim.data.fps,
							bones: anim.data.hierarchy.length,
							duration: anim.data.length,
							animation: anim,
							node: null
						});
					}

					$scope.loading = false;
				});
			});
		});
	}
	else if (node.fileType == 'pdx-script')
	{
		modService.getFileText(node.path).then(function (text) {
			$timeout(function () {
				node.treeData = pdxScriptService.readFile(text);
				node.treeDataType = 'simple';
				$scope.loading = false;
			}, 0);
		});
	}
	else if (node.fileType == 'text' || node.fileType == 'csv' || node.fileType == 'yml'
		|| node.fileType == 'python' || node.fileType == 'xml'  || node.fileType == 'lua'
		|| node.fileType == 'lua' || node.fileType == 'hlsl-header')
	{
		modService.getFileText(node.path).then(function (text) {
			$timeout(function () {
				node.textData = text;
				$scope.loading = false;
			}, 0);
		});
	}
	else
	{
		$scope.loading = false;
	}

	$scope.convertToPdxmesh = function () {
		$scope.loading = true;
		modService.getFileText($scope.node.path).then(function (text) {
			return rendererService.loadCollada(text, node.parent.path);
		}).then(function (viewObject) {
			var pdxdata = rendererService.convertToPdxmesh(viewObject.object, {
				textureBaseName: $scope.node.name.replace('.dae', ''),
			});
			var buffer = pdxDataService.writeToBuffer(pdxdata);

			var newFile = $scope.node.path.replace('.dae', '.mesh');

			return modService.writeFileBuffer(newFile, buffer, true).then(function () {
				$scope.loading = false;
			}).then(function () {
				return newFile;
			});
		}).then(function (newFile) {
			modService.loadFileNodeDirectory($scope.node.parent).then(function () {
				modService.getFileNodeByPath(newFile).then(function(newNode) {
					$state.go('inspect.file', {path: newNode.path, 'node': newNode});
					return modService.showMessage({title: 'Model converted to PDXmesh format', text: 'Model saved to `'+ newFile +'`'});
				});
			});
		});
	};

	$scope.convertToCollada = function () {
		$scope.loading = true;

		var colladaData = rendererService.convertToColladaData($scope.viewScene.viewConfig.viewObject);
		var colladaXml = rendererService.convertToColladaXml(colladaData);
		var newFile = $scope.node.path.replace('.mesh', '-export.dae');

		modService.writeFileBuffer(newFile, colladaXml, true).then(function () {
			$scope.loading = false;
		}).then(function () {
			modService.loadFileNodeDirectory($scope.node.parent).then(function () {
				modService.getFileNodeByPath(newFile).then(function(newNode) {
					$state.go('inspect.file', {path: newNode.path, 'node': newNode});
					return modService.showMessage({title: 'Model converted to Collada format', text: 'Model saved to `'+ newFile +'`'});
				});
			});
		});
	}

	$scope.convertMultipleToPdxAnim = function () {
		$scope.loading = true;
		var pdxdata = rendererService.convertMultipleToPdxAnim($scope.selectedAnimations, $scope.viewScene.scene);
		var buffer = pdxDataService.writeToBuffer(pdxdata);

		var newFile = $scope.node.path.replace('.dae', '_anim.anim').replace('.json', '_anim.anim');
		var meshFile = $scope.node.path.replace('.dae', '.mesh').replace('.json', '.mesh');

		return modService.writeFileBuffer(newFile, buffer, true).then(function () {
			$scope.loading = false;
		}).then(function () {
			modService.loadFileNodeDirectory($scope.node.parent).then(function () {
				modService.getFileNodeByPath(meshFile).then(function(meshNode) {
					$state.go('inspect.file', {path: meshNode.path, 'node': meshNode, 'animationPath': newFile});
				});

				return modService.showMessage({title: 'Animation converted to PDX animation format', text: 'Animation saved to `'+ newFile +'`'});
			});

		});
	};

	$scope.dataSample = function (data, showType) {
		if (typeof data == 'string' && showType != 'simple')
		{
			return data.length > 200 ? ('"'+ data.slice(0, 200) + '" ... (length: ' + data.length +')') : '"' + data +'"';
		}
		else if (typeof data == 'string' && showType == 'simple')
		{
			return data.length > 400 ? (data.slice(0, 400) + ' ... (length: ' + data.length +')') : data;
		}
		else if (typeof data == 'number')
		{
			return Math.round(data * 100)/100;
		}
		else if (typeof data == 'object' && data != null)
		{
			var formattedSample = [];
			for (var i = 0; i <  10 && i < data.length; i++)
			{
				formattedSample.push($scope.dataSample(data[i]));
			}

			if (data.length > 10)
				return '['+ formattedSample.join(', ') +' ... ] (count: '+ data.length +')';
			else
				return '['+ formattedSample.join(', ') +'] (count: '+ data.length +')';
		}

		return data;
	};

	$scope.zoomIn = function() {
		rendererService.zoomViewScene($scope.viewScene, 0.9);
	};
	$scope.zoomOut = function() {
		rendererService.zoomViewScene($scope.viewScene, 1.1);
	};
});

// Mod tree
myMod.controller('ModTree', ['$scope', '$state', 'modService', function ($scope, $state, modService) {

	if (!modService.data)
		modService.loadPreviousData().then(null, modService.errorCallback);

	$scope.selectedItem = {};

	$scope.dirLoading = false;

	$scope.options = {
	};

	$scope.remove = function(scope) {
		scope.remove();
	};

	$scope.toggleNode = function(scope, node) {
		if (!node.dirLoaded)
			modService.loadFileNodeDirectory(node);
		node.dirVisible = !node.dirVisible;
		scope.toggle();
	};

	$scope.open = function(node) {
		if (node.path == 'map')
			$state.go('inspect.map');
		else if (node.path == 'history/provinces')
			$state.go('inspect.provincesHistory');
		else if (node.path == 'history/countries')
			$state.go('inspect.countriesHistory');
		else
			$state.go('inspect.file', {path: node.path, 'node': node}, {inherit: false});
	};

	$scope.fileTypeToIcon = function (node) {
		if (node.fileType == 'image' || node.fileType == 'image-tga' || node.fileType == 'image-dds')
			return 'picture';
		else if (node.fileType == 'pdx-script' || node.fileType == 'csv')
			return 'list';
		else if (node.fileType == 'pdx-mesh')
			return 'globe';
		else if (node.fileType == 'pdx-animation')
			return 'film';
		else if (node.fileType == 'pdx-mod')
			return 'cog';
		else if (node.isDirectory)
			return 'folder-close';

		return 'file';
	};

	$scope.refreshOpenDirectories = function () {
		if (!$scope.dirLoading)
		{
			$scope.dirLoading = true;
			modService.refreshOpenDirectories().then(function () {
				$scope.dirLoading = false;
			});
		}
	};
}]);

//LoadMod
myMod.controller('LoadMod', ['$scope', 'modService', '$state', function ($scope, modService, $state) {
	$scope.mods = [];

	$scope.chooseModRootDir = function () {
		modService.selectProject().then(function (project) {
			modService.setRootFileEntry(project).then(function () {
				$scope.loadPreviousModData();
			}, function (error) {
				modService.showMessage({title: 'Could not load mod directory', text: error.message || String(error)});
			});
		}, function (error) {
			if (error && error.name == 'AbortError')
				return;
			modService.showMessage({title: 'Could not open mod directory', text: error.message || String(error)});
		});
	};

	$scope.loadPreviousModData = function () {
		modService.getPreviousModData().then(function (mods) {
			$scope.mods = mods;
		}, function (error) {
			modService.showMessage({title: 'Could not load cached mods', text: error.message || String(error)});
		});
	};

	$scope.deleteModData = function (modData) {
		modService.deleteModData(modData).then(function () {
				$scope.loadPreviousModData();
			}, function (error) {
				modService.showMessage({title: 'Could not remove cached mod', text: error.message || String(error)});
		});
	};

	$scope.loadModData = function (modData) {
		modService.loadModData(modData.id).then(function () {
			$state.go('inspect');
		});
	};

	$scope.exporting = false;
	$scope.exportProgress = 0;
	$scope.exportModZip = function () {
		$scope.exporting = true;
		$scope.exportProgress = 0;
		modService.exportModZip(function (percent) {
			$scope.exportProgress = percent;
		}).then(function () {
			$scope.exporting = false;
		}, function (error) {
			$scope.exporting = false;
			modService.showMessage({title: 'Could not export mod', text: error.message || String(error)});
		});
	};

	$scope.loadPreviousModData();
}]);

//Provinces History Tool
myMod.controller('ProvincesHistoryTool', ['$scope', 'modService', 'mapDrawService', '$timeout', function ($scope, modService, mapDrawService, $timeout) {
	$scope.colors = null;
	$scope.messages = '';
	$scope.output = '';
	$scope.scrollImage = null;
	$scope.loading = false;
	$scope.outputTitle = 'Output';
	$scope.messagesTitle = 'Messages';

	$scope.getProvincesFiles = function () {
		$scope.loading = true;
		$scope.output = '';
		$scope.messages = '';
		$scope.outputTitle = 'Output';

		modService.getData(modService.data.history.provinces).then(function (dataNode) {
			$scope.output = '';
			$scope.messages = 'Found '+ dataNode.byId.length +' province histories' + "\n";
			console.log(dataNode);
			$scope.loading = false;
		}, modService.errorCallback)
		/*
		modService.getFileNodeByPath('history/provinces').then(function (dataNode) {
			return modService.loadFileNodeDirectory(dataNode).then(function (dataNode) {
				$scope.output = '';
				$scope.messages = 'Found '+ dataNode.files.length +' province histories' + "\n";
				$scope.loading = false;
			});
		});
		*/
	};

	$scope.createFiles = function () {
		return modService.getData(modService.data.map.colorMapping).then(function (mappings) {
			$scope.output = '﻿l_english:'+"\n";
			$scope.outputTitle = 'prov_names_l_english.yml';
			angular.forEach(mappings.byId, function (mapping) {
				$scope.output += ' PROV'+ mapping.id +': "'+ mapping.id +'"'+"\n";
				var text = [
					'#' + mapping.id,
					'',
					'trade_goods = unknown',
					'hre = no',
					'base_tax = 1',
					'manpower = 1',
					'discovered_by = western',
					'native_size = 0',
					'native_ferocity = 0',
					'native_hostileness = 0',
					'',
				];

				var filePath = 'history/provinces/'+ mapping.id +' - Unknown '+ mapping.id +'.txt';

				modService.writeFileText(
					filePath,
					text.join("\n")
				);
			});
		}, modService.errorCallback);
	};

	$scope.getProvincesFiles();
}]);


//Countries History / Setting Tool
myMod.controller('CountriesHistoryTool', ['$scope', 'modService', 'pdxScriptService', '$timeout', function ($scope, modService, pdxScriptService, $timeout) {
	$scope.colors = null;
	$scope.messages = '';
	$scope.output = '';
	$scope.scrollImage = null;
	$scope.loading = false;
	$scope.outputTitle = 'Output';
	$scope.messagesTitle = 'Messages';

	$scope.updateCountriesFromCsv = function () {
		return modService.getFileText('jorodox/countries.csv').then(function (text) {
			var csvResult = Papa.parse(text, {header: true});

			var tagList = {};

			angular.forEach(csvResult.data, function (country) {
				tagList[country.Tag] = 'countries/'+ country.Tag +' - '+ country['Country/Union'] +'.txt';

				var countryHistoryData = {
					government: country['Government'],
					mercantilism: 0.25,
					primary_culture: 'germanic',
					religion: country['Ideology'],
					technology_group: 'western',
				};
				modService.writeFileText(
					'history/'+ tagList[country.Tag],
					pdxScriptService.writeData(countryHistoryData),
					false,
					true
				);

				var countryData = {
					graphical_culture: 'westerngfx',
					color: [country['Color R'], country['Color G'], country['Color B']],
					historical_score: 0,
					historical_idea_groups: [
						'economic_ideas',
						'offensive_ideas',
						'exploration_ideas',
						'defensive_ideas',
						'administrative_ideas',
						'maritime_ideas',
						'quality_ideas',
						'innovativeness_ideas',
					],
					historical_units: ['western_medieval_infantry', 'western_medieval_knights', 'western_men_at_arms'],
					monarch_names: {'Tester #0': 100},
					leader_names: ['McTester'],
					ship_names: ['MSS Tester'],
					army_names: ['TesterSquad'],
					fleet_names: ['Test Armada-o-$PROVINCE$'],
				};
				modService.writeFileText(
					'common/'+ tagList[country.Tag],
					pdxScriptService.writeData(countryData),
					false,
					true
				);
			});

			$scope.outputTitle = 'common/country_tags/YOUR_countries.txt';

			$scope.output = pdxScriptService.writeData(tagList);;
		});
	};

	$scope.updateProvincesFromCsv = function () {
		return modService.getData(modService.data.localisation).then(function(){
			modService.getFileText('jorodox/provinces.csv').then(function (text) {
				var csvResult = Papa.parse(text, {header: true});

				var provLocs = modService.data.localisation.byFile['localisation/prov_names_l_english.yml'].data.l_english;

				angular.forEach(csvResult.data, function (province) {
					var foundId = 0;
					angular.forEach(provLocs, function (value, key) {
						if (value == province['Name'])
							foundId = key.replace('PROV', '');
					})
					if (foundId == 0)
					{
						$scope.messages += 'No name found for "' + province['Name'] +'"' + "\n";
						return;
					}

					var fileName = 'provinces/'+ foundId +' - '+ province['Name'] +'.txt';

					var provinceHistoryData = {
						trade_goods: 'unknown',
						hre: 'no',
						base_tax: province['BaseTax'],
						manpower: province['Manpower'],
						discovered_by: 'western',
						native_size: '0',
						native_ferocity: '0',
						native_hostileness: '0',
						religion: province['Ideology'],
					};
					if (province['Controller 2015 Tag'])
					{
						provinceHistoryData.controller = province['Controller 2015 Tag'];
						provinceHistoryData.owner = province['Controller 2015 Tag'];
					}
					if (province['Cores 2015'])
						provinceHistoryData.add_core = province['Cores 2015'];

					modService.writeFileText(
						'history/'+ fileName,
						pdxScriptService.writeData(provinceHistoryData),
						false,
						true
					);
				});
			});
		});
	};
}]);

// MapCheck
myMod.controller('MapCheck', ['$scope', 'modService', 'mapAnalyzeService', 'mapDrawService', '$timeout', '$q', '$rootScope', function ($scope, modService, mapAnalyzeService, mapDrawService, $timeout, $q, $rootScope) {
	var handleMapError = function (error) {
		$scope.loading = false;
		modService.errorCallback(error);
	};

	// Map analytics data
	$scope.analytics = null;
	// Map image
	$scope.scrollImage = null;
	// If currently doing stuff
	$scope.loading = false;

	$scope.mapWidth = 2816;
	$scope.mapHeight = 1024;

	modService.getFileNodeByPath('map').then(function (node) {
		modService.setCurrent(node);
	});

	// Current map view
	$scope.view = 'provinces';

	$scope.dataViewInfo = {
		type: 'province',
		title: '',
		text: '',
		province: null,
		provinceName: '',
		ownerTag: '',
		countryName: '',
		country: null,
	};
	$scope.dataViewLeft = $scope.dataViewInfo;


	$scope.labelView = 'none';
	$scope.labelViews = [
		'none',
		'provinceName',
		'provinceId',
		'countryTag',
		'countryName',
		'countryReligion',
		'countryGovernment',
	];

	$scope.hoveredProvinceHistory = null;

	// Display options
	$scope.options = {
		showGrid: true,
		showLabels: false,
		highLight: true,
		showTerrainOverlay: true,
		selectArea: true,//false,
	};

	$scope.views = [
		'provinces',
		'baseTax',
		'baseProduction',
		'baseManpower',
		'development',
		'tradeGoods',
		'provinceTerrain',
		'climate',
		'weather',
		'monsoons',
		'culture',
		'religion',
		'government',
		'countries',
		'empty',
	];
	$scope.viewLabels = {
		provinces: 'Provinces',
		countries: 'Countries',
		baseTax: 'Base Tax',
		baseManpower: 'Base Manpower',
		baseProduction: 'Base Production',
		climate: 'Climate',
		weather: 'Weather',
		monsoons: 'Monsoons',
		provinceTerrain: 'Province Terrain',
		religion: 'Religion',
		government: 'Government',
		culture: 'Culture',
		tradeGoods: 'Trade Goods',
		development: 'Development',
		empty: 'Empty',
	};
	$scope.climateOptions = [
		{value: 'temperate', label: 'Temperate'},
		{value: 'arid', label: 'Arid'},
		{value: 'tropical', label: 'Tropical'},
		{value: 'arctic', label: 'Arctic'},
	];
	$scope.winterOptions = [
		{value: 'no_winter', label: 'No winter'},
		{value: 'mild_winter', label: 'Mild winter'},
		{value: 'normal_winter', label: 'Normal winter'},
		{value: 'severe_winter', label: 'Severe winter'},
	];
	$scope.monsoonOptions = [
		{value: 'no_monsoon', label: 'No monsoon'},
		{value: 'mild_monsoon', label: 'Mild monsoon'},
		{value: 'normal_monsoon', label: 'Normal monsoon'},
		{value: 'severe_monsoon', label: 'Severe monsoon'},
	];
	$scope.terrainOptions = [];
	$scope.provinceTerrainAvailable = false;
	$scope.valueLegend = null;
	$scope.regionOptions = [{value: '', label: 'No region'}];

	$scope.messages = '';
	$scope.output = '';
	$scope.outputTitle = 'Output';
	$scope.messagesTitle = 'Messages';
	$scope.closestArea = 25;

	$scope.historyData = null;

	$scope.selectedProvinces = [];
	$scope.selectedAreas = [];

	$scope.labels = [];

	$scope.hasSeasPng = false;

	$scope.hoverEffect = 'outlineAreaSolo';
	$scope.hoverEffectClear = 'outlineAreaSolo';
	$scope.selectEffect = 'inlineProvinceSolo';
	$scope.selectEffectClear = 'fillProvinceSolo';

	$scope.hoverCanvas = document.getElementById('PanZoomCanvasHover');
	$scope.selectCanvas = document.getElementById('PanZoomCanvasSelect');
	$scope.mapCanvas = document.getElementById('PanZoomCanvas');
	var syncMapCanvasDimensions = function (image) {
		if (!image.width || !image.height)
			return $q.reject(new Error('The map image has invalid dimensions.'));

		return $timeout(function () {
			var canvasIds = ['PanZoomCanvas', 'PanZoomCanvasSelect', 'PanZoomCanvasHover'];
			var mapCanvas = document.getElementById('PanZoomCanvas');
			if (!mapCanvas)
				throw new Error('The map canvas is not available after the map image loaded.');

			angular.forEach(canvasIds, function (canvasId) {
				var canvas = document.getElementById(canvasId);
				if (canvas && (canvas.width != image.width || canvas.height != image.height))
				{
					mapDrawService.clearCanvasCache(canvas);
					canvas.width = image.width;
					canvas.height = image.height;
				}
			});

			$scope.mapCanvas = mapCanvas;
			$scope.selectCanvas = document.getElementById('PanZoomCanvasSelect');
			$scope.hoverCanvas = document.getElementById('PanZoomCanvasHover');
			return mapCanvas;
		});
	};
	var getMapCoordinates = function (event) {
		var canvas = document.getElementById('PanZoomCanvas');
		if (!event || !canvas || !canvas.width || !canvas.height
			|| !isFinite(event.clientX) || !isFinite(event.clientY))
			return null;
		var bounds = canvas.getBoundingClientRect();
		if (!bounds.width || !bounds.height)
			return null;
		var x = Math.floor((event.clientX - bounds.left) * canvas.width / bounds.width);
		var y = Math.floor((event.clientY - bounds.top) * canvas.height / bounds.height);
		if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height)
			return null;
		return {x: x, y: y};
	};

	$scope.overlayImage = null;
	var terrainColormapCandidates = [
		'map/terrain/colormap.png',
		'map/terrain/colormap_summer.dds',
		'map/terrain/colormap_spring.dds',
		'map/terrain/colormap_autumn.dds',
		'map/terrain/colormap_winter.dds',
	];
	var loadTerrainColormap = function (candidateIndex) {
		if (candidateIndex >= terrainColormapCandidates.length)
		{
			console.info('[map-analysis] No supported terrain colormap was found.');
			$scope.options.showTerrainOverlay = false;
			return $q.when();
		}

		var path = terrainColormapCandidates[candidateIndex];
		return modService.getFileEntry(path, null, true).then(function (entry) {
			if (!entry)
			{
				if (candidateIndex == 0)
					console.info('[map-analysis] Missing optional file: '+ path);
				return loadTerrainColormap(candidateIndex + 1);
			}

			var imagePromise = path.substr(-4) == '.png'
				? modService.getImageByPath(path).then(function (image) { return image.src; })
				: modService.getFileBuffer(path).then(function (buffer) {
					return mapAnalyzeService.decodeDxt1ToDataUrl(buffer);
				});

			return imagePromise.then(function (imageUrl) {
				$scope.overlayImage = imageUrl;
			}, function (error) {
				console.warn('[map-analysis] Unable to load optional file: '+ path, error);
				return loadTerrainColormap(candidateIndex + 1);
			});
		}, handleMapError);
	};
	loadTerrainColormap(0);

	var environmentViewPalettes = {
		climate: {
			key: '_climate',
			defaultCategory: 'temperate',
			colors: {
				temperate: [102, 127, 68, 255],
				arid: [216, 214, 66, 255],
				tropical: [102, 178, 48, 255],
				arctic: [255, 255, 255, 255],
			},
		},
		weather: {
			key: '_winter',
			defaultCategory: 'no_winter',
			colors: {
				no_winter: [0, 0, 0, 255],
				mild_winter: [85, 85, 85, 255],
				normal_winter: [170, 170, 170, 255],
				severe_winter: [255, 255, 255, 255],
			},
		},
		monsoons: {
			key: '_monsoon',
			defaultCategory: 'no_monsoon',
			colors: {
				no_monsoon: [0, 0, 0, 255],
				mild_monsoon: [0, 0, 85, 255],
				normal_monsoon: [0, 0, 170, 255],
				severe_monsoon: [0, 0, 255, 255],
			},
		},
	};
	var provinceValueColors = [
		'#7A0063',
		'#6A0183',
		'#3E038D',
		'#0D0596',
		'#0839A0',
		'#0A7AA9',
		'#0DB2A5',
		'#11BC6E',
		'#14C632',
		'#3ECF18',
		'#8AD91B',
		'#DAE220',
		'#ECA824',
		'#F56329',
		'#FF2E41',
		'#FF2E41',
		'#FF2E41',
		'#FF2E41',
		'#FF2E41',
		'#FF2E41',
	];
	var getNumericValueOrZero = function (value) {
		if (value === null || value === undefined || value === '')
			return 0;
		var number = Number(value);
		return isFinite(number) ? number : 0;
	};
	var getProvinceState = function (province) {
		return province && (province._effectiveData || province.data && province.data.data) || {};
	};
	var getProvinceDevelopmentValue = function (province) {
		var data = getProvinceState(province);
		return getNumericValueOrZero(data.base_tax)
			+ getNumericValueOrZero(data.base_production)
			+ getNumericValueOrZero(data.base_manpower);
	};
	$scope.getProvinceDevelopment = getProvinceDevelopmentValue;
	var provinceTerrainState = null;
	var provinceTerrainLoadPromise = null;
	var findPdxNode = function (node, name) {
		if (!node || !node.subNodes)
			return null;
		for (var i = 0; i < node.subNodes.length; i++)
		{
			if (node.subNodes[i].name == name)
				return node.subNodes[i];
		}
		return null;
	};
	var terrainColor = function (value) {
		if (!value)
			return null;
		var values = angular.isArray(value) ? value : [value];
		if (values.length < 3)
			return null;
		var color = [];
		for (var i = 0; i < 3; i++)
		{
			var channel = Number(values[i]);
			if (!isFinite(channel) || channel < 0 || channel > 255)
				return null;
			color.push(Math.round(channel));
		}
		return color;
	};
	var getTerrainPath = function (value, fallback) {
		var path = String(value || fallback).replace(/^["']|["']$/g, '').replace(/\\/g, '/');
		path = path.replace(/^\/+/, '');
		if (path.indexOf('map/') != 0)
			path = 'map/' + path;
		return path;
	};
	var parseTerrainBitmap = function (buffer, expectedWidth, expectedHeight) {
		if (!buffer || buffer.byteLength < 54)
			throw new Error('Terrain bitmap is too small to contain a BMP header.');
		var view = new DataView(buffer);
		var bytes = new Uint8Array(buffer);
		if (view.getUint16(0, true) != 0x4d42)
			throw new Error('Terrain bitmap is not a BMP file.');
		var pixelOffset = view.getUint32(10, true);
		var dibSize = view.getUint32(14, true);
		var width = view.getInt32(18, true);
		var signedHeight = view.getInt32(22, true);
		var planes = view.getUint16(26, true);
		var bitsPerPixel = view.getUint16(28, true);
		var compression = view.getUint32(30, true);
		var height = Math.abs(signedHeight);
		if (dibSize < 40 || width < 1 || height < 1 || planes != 1
			|| bitsPerPixel != 8 || compression != 0)
			throw new Error('Terrain bitmap must be an uncompressed 8-bit BMP.');
		if (expectedWidth && width != expectedWidth || expectedHeight && height != expectedHeight)
			throw new Error('Terrain bitmap dimensions do not match map/provinces.bmp.');

		var paletteOffset = 14 + dibSize;
		var colorsUsed = view.getUint32(46, true);
		var paletteLength = colorsUsed || 256;
		if (paletteOffset + paletteLength * 4 > pixelOffset)
			throw new Error('Terrain bitmap has an invalid color table.');
		var palette = [];
		for (var i = 0; i < paletteLength; i++)
		{
			var offset = paletteOffset + i * 4;
			palette[i] = [bytes[offset + 2], bytes[offset + 1], bytes[offset]];
		}
		var rowStride = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
		if (pixelOffset + rowStride * height > buffer.byteLength)
			throw new Error('Terrain bitmap pixel data is truncated.');

		return {
			buffer: buffer,
			pixels: new Uint8Array(buffer),
			pixelOffset: pixelOffset,
			width: width,
			height: height,
			signedHeight: signedHeight,
			rowStride: rowStride,
			palette: palette,
		};
	};
	var getTerrainPixelIndex = function (bitmap, x, y) {
		if (x < 0 || x >= bitmap.width || y < 0 || y >= bitmap.height)
			return null;
		var bitmapY = bitmap.signedHeight > 0 ? bitmap.height - 1 - y : y;
		return bitmap.pixels[bitmap.pixelOffset + bitmapY * bitmap.rowStride + x];
	};
	var buildProvinceTerrain = function (bitmapPath, bitmap, mapping, provinces, terrainNode) {
		var terrainRoot = terrainNode && terrainNode.data;
		var categoriesNode = findPdxNode(terrainRoot, 'categories');
		var graphicalTerrainNode = findPdxNode(terrainRoot, 'terrain');
		var categoryColors = {};
		var categoryOrder = [];
		var overrideByProvince = {};
		var terrainByIndex = {};
		var optionByValue = {};
		angular.forEach(categoriesNode && categoriesNode.subNodes || [], function (category) {
			var color = terrainColor(category.data && category.data.color);
			if (color)
				categoryColors[category.name] = color;
			categoryOrder.push(category);
			var overrideIds = category.data && category.data.terrain_override;
			if (overrideIds !== null && overrideIds !== undefined)
			{
				overrideIds = angular.isArray(overrideIds) ? overrideIds : [overrideIds];
				angular.forEach(overrideIds, function (id) {
					var provinceId = parseInt(id, 10);
					if (isFinite(provinceId) && provinceId > 0 && !overrideByProvince[provinceId])
						overrideByProvince[provinceId] = category.name;
				});
			}
		});
		angular.forEach(bitmap && graphicalTerrainNode && graphicalTerrainNode.subNodes || [], function (definition) {
			var data = definition.data || {};
			var categoryName = data.type || definition.name;
			var indices = angular.isArray(data.color) ? data.color : data.color == null ? [] : [data.color];
			angular.forEach(indices, function (indexValue) {
				var index = Number(indexValue);
				if (!isFinite(index) || Math.floor(index) != index || index < 0 || index > 255)
					return;
				var color = categoryColors[categoryName] || bitmap.palette[index];
				var definitionForIndex = {
					value: categoryName,
					label: categoryName.replace(/_/g, ' '),
					color: color || [150, 150, 150],
					bitmapIndex: index,
				};
				if (!terrainByIndex[index])
					terrainByIndex[index] = definitionForIndex;
				if (!optionByValue[categoryName]
					|| index < optionByValue[categoryName].bitmapIndex)
				{
					optionByValue[categoryName] = definitionForIndex;
				}
			});
		});
		angular.forEach(overrideByProvince, function (categoryName) {
			if (optionByValue[categoryName])
				return;
			var color = categoryColors[categoryName] || [150, 150, 150];
			optionByValue[categoryName] = {
				value: categoryName,
				label: categoryName.replace(/_/g, ' '),
				color: color,
				bitmapIndex: null,
				overrideOnly: true,
			};
		});

		var indexCountsByProvince = {};
		var observedIndices = {};
		angular.forEach(bitmap && mapping.areaByProvinceId || {}, function (area, provinceId) {
			if (!area || !angular.isArray(area.offsetRanges))
				return;
			var counts = {};
			angular.forEach(area.offsetRanges, function (range) {
				var y = range[0];
				for (var x = range[1]; x <= range[2]; x++)
				{
					var index = getTerrainPixelIndex(bitmap, x, y);
					if (index === null)
						continue;
					counts[index] = (counts[index] || 0) + 1;
					observedIndices[index] = true;
				}
			});
			indexCountsByProvince[provinceId] = counts;
		});

		angular.forEach(observedIndices, function (unused, indexText) {
			var index = Number(indexText);
			if (terrainByIndex[index])
				return;
			var color = bitmap.palette[index] || [150, 150, 150];
			var option = {
				value: 'index:' + index,
				label: 'Terrain index ' + index,
				color: color,
				bitmapIndex: index,
			};
			terrainByIndex[index] = option;
			optionByValue[option.value] = option;
		});

		var terrainOptions = [];
		angular.forEach(optionByValue, function (option) {
			terrainOptions.push(option);
		});
		terrainOptions.sort(function (a, b) { return a.label.localeCompare(b.label); });

		var terrainByProvince = {};
		var mappedProvinceCount = 0;
		angular.forEach(provinces.byId, function (province, provinceId) {
			var counts = indexCountsByProvince[provinceId];
			var selectedIndex = null;
			var selectedCount = -1;
			angular.forEach(counts || {}, function (count, indexText) {
				var index = Number(indexText);
				if (terrainByIndex[index] && count > selectedCount)
				{
					selectedIndex = index;
					selectedCount = count;
				}
			});
			var overrideCategory = overrideByProvince[provinceId];
			var definition = selectedIndex === null ? null : terrainByIndex[selectedIndex];
			if (!overrideCategory && !definition)
			{
				province._terrain = null;
				return;
			}
			var value = overrideCategory || definition.value;
			var color = overrideCategory
				? categoryColors[overrideCategory] || [150, 150, 150]
				: definition.color;
			var provinceTerrain = {
				_type: 'classification',
				_value: value,
				name: value,
				color: color,
				bitmapIndex: selectedIndex,
				_savedValue: value,
				_savedIndex: selectedIndex,
				_override: overrideCategory || null,
				_savedOverride: overrideCategory || null,
			};
			province._terrain = provinceTerrain;
			mappedProvinceCount++;
			terrainByProvince[provinceId] = {
				value: value,
				bitmapIndex: selectedIndex,
				color: color.slice(),
				override: overrideCategory || null,
			};
		});

		$scope.terrainOptions = terrainOptions;
		var available = mappedProvinceCount > 0;
		$scope.provinceTerrainAvailable = available;
		$scope.environmentDataAvailable = $scope.environmentDataAvailable || {};
		$scope.environmentDataAvailable._terrain = available;
		return {
			available: available,
			bitmapPath: bitmapPath,
			bitmap: bitmap,
			terrainNode: terrainNode,
			areaByProvinceId: mapping.areaByProvinceId,
			optionByValue: optionByValue,
			categoryOrder: categoryOrder,
			overrideByProvince: overrideByProvince,
			terrainByIndex: terrainByIndex,
			terrainByProvince: terrainByProvince,
		};
	};
	var applyProvinceTerrainToHistory = function (state) {
		var provinces = modService.data.history.provinces;
		if (!provinces || !provinces.byId)
			return;
		angular.forEach(provinces.byId, function (province, provinceId) {
			var terrain = state.terrainByProvince[provinceId];
			province._terrain = terrain ? {
				_type: 'classification',
				_value: terrain.value,
				name: terrain.value,
				color: terrain.color.slice(),
				bitmapIndex: terrain.bitmapIndex,
				_savedValue: terrain.value,
				_savedIndex: terrain.bitmapIndex,
				_override: terrain.override || null,
				_savedOverride: terrain.override || null,
			} : null;
		});
	};
	var loadProvinceTerrain = function (loadedEnvironment) {
		if (provinceTerrainState)
		{
			applyProvinceTerrainToHistory(provinceTerrainState);
			$scope.provinceTerrainAvailable = provinceTerrainState.available;
			return $q.when(provinceTerrainState);
		}
		if (provinceTerrainLoadPromise)
			return provinceTerrainLoadPromise;

		var loadEnvironmentPromise = loadedEnvironment
			? $q.when(loadedEnvironment)
			: modService.loadMapEnvironment(['default', 'terrain']);
		provinceTerrainLoadPromise = loadEnvironmentPromise.then(function (environment) {
			var defaultData = environment.default && environment.default.data || {};
			var bitmapPath = getTerrainPath(defaultData.terrain, 'terrain.bmp');
			var definitionPath = getTerrainPath(defaultData.terrain_definition, 'terrain.txt');
			return $q.all({
				entry: modService.getFileEntry(bitmapPath, null, true),
				mapping: modService.getData(modService.data.map.provinceMapping),
				provinces: modService.getData(modService.data.history.provinces),
				provinceImage: modService.getData(modService.data.map.provinces.image).then(function (imageNode) {
					return modService.getImage(imageNode);
				}),
				terrainNode: definitionPath == 'map/terrain.txt' && environment.nodesByName.terrain
					? $q.when(environment.nodesByName.terrain)
					: modService.getFileEntry(definitionPath, null, true).then(function (entry) {
						if (!entry)
						{
							console.info('[map-analysis] Missing optional file: ' + definitionPath);
							return null;
						}
						return modService.getPdxScriptDataByPath(definitionPath).catch(function (error) {
							if (error && error.name == 'NotFoundError')
							{
								console.info('[map-analysis] Missing optional file: ' + definitionPath);
								return null;
							}
							throw error;
						});
					}),
			}).then(function (loaded) {
				if (!loaded.entry)
					console.info('[map-analysis] Missing optional file: ' + bitmapPath);
				var bitmapPromise = loaded.entry
					? modService.getFileBuffer(bitmapPath).then(function (buffer) {
					var bitmap;
					try
					{
						bitmap = parseTerrainBitmap(buffer, loaded.provinceImage.width, loaded.provinceImage.height);
					}
					catch (error)
					{
						console.warn('[map-analysis] Terrain bitmap unavailable: ' + error.message);
					}
					return bitmap || null;
				})
					: $q.when(null);
				return bitmapPromise.then(function (bitmap) {
					return buildProvinceTerrain(bitmapPath, bitmap, loaded.mapping, loaded.provinces, loaded.terrainNode);
				});
			});
		}).then(function (state) {
			provinceTerrainState = state;
			if (state)
				applyProvinceTerrainToHistory(state);
			return state;
		}, function (error) {
			provinceTerrainLoadPromise = null;
			throw error;
		});
		return provinceTerrainLoadPromise;
	};
	var saveProvinceTerrain = function (provinces) {
		if (!provinceTerrainState || !provinceTerrainState.available)
			return $q.when();
		var changedProvinces = [];
		angular.forEach(provinces, function (province) {
			if (!province || !province._terrain)
				return;
			var option = provinceTerrainState.optionByValue[province._terrain._value];
			if (!option)
				throw new Error('The selected province terrain is not available.');
			if (province._terrain._savedValue != option.value)
				changedProvinces.push({province: province, option: option});
		});
		if (!changedProvinces.length)
			return $q.when();

		var bitmapChanges = [];
		angular.forEach(changedProvinces, function (change) {
			if (change.option.bitmapIndex !== null && change.option.bitmapIndex !== undefined)
				bitmapChanges.push(change);
		});
		var buffer = null;
		if (bitmapChanges.length)
		{
			if (!provinceTerrainState.bitmap)
				throw new Error('Terrain bitmap is unavailable for the selected province terrain.');
			buffer = provinceTerrainState.bitmap.buffer.slice(0);
			var pixels = new Uint8Array(buffer);
			angular.forEach(bitmapChanges, function (change) {
				var area = provinceTerrainState.areaByProvinceId[parseInt(change.province._id, 10)];
				if (!area || !angular.isArray(area.offsetRanges))
					throw new Error('Province pixels are unavailable for province ' + change.province._id + '.');
				angular.forEach(area.offsetRanges, function (range) {
					var y = range[0];
					var bitmapY = provinceTerrainState.bitmap.signedHeight > 0
						? provinceTerrainState.bitmap.height - 1 - y : y;
					var start = provinceTerrainState.bitmap.pixelOffset
						+ bitmapY * provinceTerrainState.bitmap.rowStride + range[1];
					for (var offset = start; offset <= start + range[2] - range[1]; offset++)
						pixels[offset] = change.option.bitmapIndex;
				});
			});
		}

		var overrideChanged = false;
		var overrideSnapshots = [];
		angular.forEach(changedProvinces, function (change) {
			var provinceId = parseInt(change.province._id, 10);
			var desiredCategory = change.option.overrideOnly ? change.option.value : null;
			angular.forEach(provinceTerrainState.categoryOrder, function (category) {
				var data = category.data || (category.data = {});
				var rawIds = data.terrain_override;
				if (rawIds === null || rawIds === undefined)
				{
					if (category.name != desiredCategory)
						return;
					rawIds = [];
				}
				else if (!angular.isArray(rawIds))
					rawIds = [rawIds];

				var ids = [];
				var keptTargetId = false;
				angular.forEach(rawIds, function (id) {
					if (parseInt(id, 10) != provinceId)
					{
						ids.push(id);
						return;
					}
					if (category.name == desiredCategory && !keptTargetId)
					{
						ids.push(id);
						keptTargetId = true;
					}
				});
				if (category.name == desiredCategory && !keptTargetId)
					ids.push(String(provinceId));

				var changed = ids.length != rawIds.length;
				if (!changed)
					angular.forEach(ids, function (id, index) {
						if (String(id) != String(rawIds[index]))
							changed = true;
					});
				if (changed)
				{
					overrideSnapshots.push({
						data: data,
						hadValue: Object.prototype.hasOwnProperty.call(data, 'terrain_override'),
						value: data.terrain_override,
					});
					if (ids.length)
						data.terrain_override = ids;
					else
						delete data.terrain_override;
					overrideChanged = true;
				}
			});
		});

		var restoreTerrainOverrides = function () {
			for (var i = overrideSnapshots.length - 1; i >= 0; i--)
			{
				var snapshot = overrideSnapshots[i];
				if (snapshot.hadValue)
					snapshot.data.terrain_override = snapshot.value;
				else
					delete snapshot.data.terrain_override;
			}
		};
		if (overrideChanged && !provinceTerrainState.terrainNode)
		{
			restoreTerrainOverrides();
			throw new Error('Terrain definitions are unavailable for saving terrain overrides.');
		}

		var saves = [];
		if (bitmapChanges.length)
			saves.push(modService.writeFileBuffer(provinceTerrainState.bitmapPath, buffer, true));
		if (overrideChanged)
			saves.push(modService.saveData(provinceTerrainState.terrainNode));
		return $q.all(saves).then(function () {
			if (bitmapChanges.length)
			{
				provinceTerrainState.bitmap.buffer = buffer;
				provinceTerrainState.bitmap.pixels = new Uint8Array(buffer);
			}
			angular.forEach(changedProvinces, function (change) {
				var previousIndex = change.province._terrain._savedIndex;
				var bitmapIndex = change.option.bitmapIndex !== null
					&& change.option.bitmapIndex !== undefined
					? change.option.bitmapIndex
					: previousIndex;
				var override = change.option.overrideOnly ? change.option.value : null;
				change.province._terrain.name = change.option.value;
				change.province._terrain._value = change.option.value;
				change.province._terrain.color = change.option.color;
				change.province._terrain.bitmapIndex = bitmapIndex;
				change.province._terrain._savedValue = change.option.value;
				change.province._terrain._savedIndex = bitmapIndex;
				change.province._terrain._override = override;
				change.province._terrain._savedOverride = override;
				if (override)
					provinceTerrainState.overrideByProvince[parseInt(change.province._id, 10)] = override;
				else
					delete provinceTerrainState.overrideByProvince[parseInt(change.province._id, 10)];
				provinceTerrainState.terrainByProvince[change.province._id] = {
					value: change.option.value,
					bitmapIndex: bitmapIndex,
					color: change.option.color.slice(),
					override: override,
				};
			});
			return true;
		}, function (error) {
			restoreTerrainOverrides();
			return $q.reject(error);
		});
	};
	var getWaterProvinces = function (defaultData, provinces) {
		var waterById = {};
		var addWaterProvince = function (value) {
			if (angular.isArray(value))
			{
				angular.forEach(value, addWaterProvince);
				return;
			}
			var id = angular.isObject(value)
				? value._id || value.id || value.nr
				: value;
			if (id !== null && id !== undefined && /^\d+$/.test(String(id)))
				waterById[parseInt(id, 10)] = true;
		};
		angular.forEach(defaultData.sea_zones, addWaterProvince);
		angular.forEach(defaultData.sea_starts, addWaterProvince);
		angular.forEach(defaultData.lakes, addWaterProvince);
		angular.forEach(provinces.byId, function (province, provinceId) {
			if (province._isSeaStart || province._isLake)
				waterById[provinceId] = true;
		});
		var waterProvinces = [];
		angular.forEach(waterById, function (isWater, provinceId) {
			var province = provinces.byId[provinceId];
			waterProvinces.push(province || provinceId);
		});
		return waterProvinces;
	};
	var renderProvinceValueView = function (dataNode, valueKey, label) {
		$scope.valueLegend = null;
		mapDrawService.colorCanvas($scope.mapCanvas, [200, 200, 200, 255]);
		return modService.getData(modService.data.history.provinces).then(function (provinces) {
			var maximum = 0;
			angular.forEach(provinces.byId, function (province) {
				var value = valueKey == 'development'
					? getProvinceDevelopmentValue(province)
					: Number(getProvinceState(province)[valueKey]);
				if (isFinite(value) && value >= 0)
					maximum = Math.max(maximum, value);
			});

			var provinceGroups = [];
			for (var i = 0; i < provinceValueColors.length; i++)
				provinceGroups[i] = [];
			angular.forEach(provinces.byId, function (province) {
				var rawValue = valueKey == 'development'
					? getProvinceDevelopmentValue(province)
					: getProvinceState(province)[valueKey];
				if (rawValue === null || rawValue === undefined || rawValue === '')
					return;
				var value = Number(rawValue);
				if (!isFinite(value) || value < 0)
					return;
				var colorIndex = maximum
					? Math.min(provinceValueColors.length - 1,
						Math.round(value / maximum * (provinceValueColors.length - 1)))
					: 0;
				provinceGroups[colorIndex].push(province);
			});
			var fills = [];
			angular.forEach(provinceGroups, function (group, colorIndex) {
				if (group.length)
					fills.push(mapDrawService.fillProvinces(
						$scope.mapCanvas,
						group,
						provinceValueColors[colorIndex],
						true
					));
			});
			var stops = [];
			angular.forEach(provinceValueColors, function (color, colorIndex) {
				stops.push(color + ' ' + Math.round(colorIndex / (provinceValueColors.length - 1) * 100) + '%');
			});
			$scope.valueLegend = {
				label: label,
				min: 0,
				max: maximum,
				gradient: 'linear-gradient(to right, ' + stops.join(', ') + ')',
			};
			return $q.all(fills).then(function () {
				var defaultData = dataNode.default && dataNode.default.data || {};
				var waterProvinces = getWaterProvinces(defaultData, provinces);
				var waterFills = [];
				if (defaultData.major_rivers)
					waterFills.push(mapDrawService.fillProvinces($scope.mapCanvas, defaultData.major_rivers, [6, 115, 249, 255], true));
				if (waterProvinces.length)
					waterFills.push(mapDrawService.fillProvinces($scope.mapCanvas, waterProvinces, [68, 107, 163, 255], true));
				return $q.all(waterFills);
			});
		}).then(function () {
			return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
				$scope.loading = false;
			});
		});
	};
	var categoryColorCache = {};
	var getCategoryColor = function (category, definitionColors) {
		if (definitionColors)
		{
			var definedColor = definitionColors[category.toLowerCase()];
			if (definedColor)
				return definedColor;
			return category.toLowerCase() == 'unowned'
				? [76, 76, 76, 255]
				: [150, 150, 150, 255];
		}

		if (categoryColorCache[category])
			return categoryColorCache[category];

		var hash = 0;
		for (var i = 0; i < category.length; i++)
			hash = ((hash << 5) - hash + category.charCodeAt(i)) | 0;
		var hue = (hash >>> 0) % 360;
		var saturation = 0.62;
		var lightness = 0.52;
		var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
		var hueSection = hue / 60;
		var secondary = chroma * (1 - Math.abs(hueSection % 2 - 1));
		var red = 0, green = 0, blue = 0;
		if (hueSection < 1) { red = chroma; green = secondary; }
		else if (hueSection < 2) { red = secondary; green = chroma; }
		else if (hueSection < 3) { green = chroma; blue = secondary; }
		else if (hueSection < 4) { green = secondary; blue = chroma; }
		else if (hueSection < 5) { red = secondary; blue = chroma; }
		else { red = chroma; blue = secondary; }
		var match = lightness - chroma / 2;
		categoryColorCache[category] = [
			Math.round((red + match) * 255),
			Math.round((green + match) * 255),
			Math.round((blue + match) * 255),
			255,
		];
		return categoryColorCache[category];
	};
	var getCategoryValue = function (value) {
		if (angular.isObject(value))
		{
			if (value._value !== undefined)
				value = value._value;
			else if (value.value !== undefined)
				value = value.value;
			else
				return '';
		}
		if (value === null || value === undefined)
			return '';
		return String(value).trim();
	};
	var getCategoryLabel = function (value) {
		return value.replace(/_/g, ' ');
	};
	var renderCategoryView = function (dataNode, viewName) {
		$scope.valueLegend = null;
		mapDrawService.colorCanvas($scope.mapCanvas, [200, 200, 200, 255]);
		var provinceKey = {
			religion: 'religion',
			government: 'government',
			culture: 'culture',
			tradeGoods: 'trade_goods',
		}[viewName];
		var countryKey = viewName == 'government' ? 'government'
			: viewName == 'religion' ? 'religion' : null;
		var definitionNodes = {
			religion: modService.data.common && modService.data.common.religions,
			government: modService.data.common && modService.data.common.governments,
			tradeGoods: modService.data.common && modService.data.common.tradegoods,
		};
		var definitionNode = definitionNodes[viewName];
		var usesDefinitionColors = viewName != 'culture';

		return $q.all({
			provinces: modService.getData(modService.data.history.provinces),
			definitions: definitionNode ? modService.getData(definitionNode) : $q.when(null),
		}).then(function (loaded) {
			var provinces = loaded.provinces;
			var definitionColors = usesDefinitionColors
				? loaded.definitions && loaded.definitions.colorByName || {}
				: null;
			var ownerTags = [];
			if (countryKey)
			{
				angular.forEach(provinces.byId, function (province) {
					var owner = getProvinceState(province).owner;
					if (owner && ownerTags.indexOf(owner) == -1)
						ownerTags.push(owner);
				});
			}
			return getCountryHistoryByTag(ownerTags).then(function (countryHistory) {
				var provincesByCategory = {};
				angular.forEach(provinces.byId, function (province) {
					var data = getProvinceState(province);
					var owner = getCategoryValue(data.owner);
					var category = provinceKey ? getCategoryValue(data[provinceKey]) : '';
					var country = owner && (countryHistory[owner] || countryHistory[owner.toUpperCase()]);

					if (!category && countryKey && country)
					{
						category = getCategoryValue(country[countryKey]);
						if (!category && viewName == 'government')
							category = getCategoryValue(country.government_reform || country.government_type);
					}
					if (!category)
						category = owner ? 'Unknown' : 'Unowned';

					if (!provincesByCategory[category])
						provincesByCategory[category] = [];
					provincesByCategory[category].push(province);
				});

				var categories = Object.keys(provincesByCategory).sort(function (a, b) {
					return a.localeCompare(b);
				});
				var fills = [];
				var legend = [];
				angular.forEach(categories, function (category) {
					var color = getCategoryColor(category, definitionColors);
					fills.push(mapDrawService.fillProvinces(
						$scope.mapCanvas,
						provincesByCategory[category],
						color,
						true
					));
					legend.push({
						label: getCategoryLabel(category),
						color: 'rgb('+ color[0] +', '+ color[1] +', '+ color[2] +')',
					});
				});
				$scope.valueLegend = {
					label: $scope.viewLabels[viewName],
					categories: legend,
				};

				return $q.all(fills).then(function () {
					var defaultData = dataNode.default && dataNode.default.data || {};
					var waterProvinces = getWaterProvinces(defaultData, provinces);
					var waterFills = [];
					if (defaultData.major_rivers)
						waterFills.push(mapDrawService.fillProvinces($scope.mapCanvas, defaultData.major_rivers, [6, 115, 249, 255], true));
					if (waterProvinces.length)
						waterFills.push(mapDrawService.fillProvinces($scope.mapCanvas, waterProvinces, [68, 107, 163, 255], true));
					return $q.all(waterFills);
				});
			});
		}).then(function () {
			return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
				$scope.loading = false;
			});
		});
	};
	var renderEmptyView = function (dataNode) {
		$scope.valueLegend = null;
		mapDrawService.colorCanvas($scope.mapCanvas, [200, 200, 200, 255]);
		return modService.getData(modService.data.history.provinces).then(function (provinces) {
			var allProvinces = [];
			angular.forEach(provinces.byId, function (province) {
				if (province)
					allProvinces.push(province);
			});
			return mapDrawService.fillProvinces(
				$scope.mapCanvas,
				allProvinces,
				[128, 128, 128, 255],
				true
			).then(function () {
				var defaultData = dataNode.default && dataNode.default.data || {};
				var waterProvinces = getWaterProvinces(defaultData, provinces);
				if (!waterProvinces.length)
					return;
				return mapDrawService.fillProvinces(
					$scope.mapCanvas,
					waterProvinces,
					[68, 107, 163, 255],
					true
				);
			});
		}).then(function () {
			return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
				$scope.loading = false;
			});
		});
	};
	var renderProvinceTerrainView = function (environment) {
		$scope.valueLegend = null;
		mapDrawService.colorCanvas($scope.mapCanvas, [200, 200, 200, 255]);
		return loadProvinceTerrain(environment).then(function (state) {
			if (!state)
				return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
					$scope.loading = false;
				});
			var provincesByColor = {};
			var colorsByKey = {};
			angular.forEach(modService.data.history.provinces.byId, function (province) {
				if (!province._terrain)
					return;
				var key = province._terrain.color.join(',');
				if (!provincesByColor[key])
				{
					provincesByColor[key] = [];
					colorsByKey[key] = province._terrain.color.concat([255]);
				}
				provincesByColor[key].push(province);
			});
			var fills = [];
			angular.forEach(provincesByColor, function (group, key) {
				fills.push(mapDrawService.fillProvinces($scope.mapCanvas, group, colorsByKey[key], true));
			});
			return $q.all(fills).then(function () {
				return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
					$scope.loading = false;
				});
			});
		});
	};
	var renderEnvironmentView = function (dataNode, viewName) {
		var palette = environmentViewPalettes[viewName];
		mapDrawService.colorCanvas($scope.mapCanvas, [200, 200, 200, 255]);

		var defaultData = dataNode.default && dataNode.default.data || {};
		return modService.getData(modService.data.history.provinces).then(function (provinces) {
			var provincesByCategory = {};
			angular.forEach(provinces.byId, function (province) {
				var classification = province[palette.key];
				var category = classification && classification._value;
				if (!palette.colors[category])
					category = palette.defaultCategory;
				if (!provincesByCategory[category])
					provincesByCategory[category] = [];
				provincesByCategory[category].push(province);
			});

			var fills = [];
			angular.forEach(palette.colors, function (color, category) {
				if (provincesByCategory[category] && provincesByCategory[category].length)
					fills.push(mapDrawService.fillProvinces($scope.mapCanvas, provincesByCategory[category], color, true));
			});
			return $q.all(fills);
		}).then(function () {
			var waterProvinces = getWaterProvinces(defaultData, modService.data.history.provinces);
			var waterFills = [];
			if (defaultData.major_rivers)
				waterFills.push(mapDrawService.fillProvinces($scope.mapCanvas, defaultData.major_rivers, [6, 115, 249, 255], true));
			if (waterProvinces.length)
				waterFills.push(mapDrawService.fillProvinces($scope.mapCanvas, waterProvinces, [68, 107, 163, 255], true));
			return $q.all(waterFills);
		}).then(function () {
			return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
				$scope.loading = false;
			});
		});
	};

	$scope.$watch('view', function(newValue, oldValue) {
		$scope.loading = true;
		$scope.valueLegend = null;
		$scope.hoverCanvas = document.getElementById('PanZoomCanvasHover');
		$scope.selectCanvas = document.getElementById('PanZoomCanvasSelect');
		$scope.mapCanvas = document.getElementById('PanZoomCanvas');

		var environmentFiles = [];
		if (newValue == 'countries' || newValue == 'countryReligion' || newValue == 'baseTax'
			|| newValue == 'baseManpower' || newValue == 'baseProduction'
			|| newValue == 'religion' || newValue == 'government' || newValue == 'culture'
			|| newValue == 'tradeGoods' || newValue == 'development' || newValue == 'empty')
			environmentFiles = ['default'];
		else if (newValue == 'climate' || newValue == 'weather' || newValue == 'monsoons')
			environmentFiles = ['default', 'climate'];
		else if (newValue == 'provinceTerrain')
			environmentFiles = ['default', 'terrain'];

		modService.loadMapEnvironment(environmentFiles).then(function (environment) {
			if (environment.default && environment.default.data.width)
			{
				$scope.mapWidth = environment.default.data.width;
				$scope.mapHeight = environment.default.data.height;
			}

			if (newValue == 'provinces')
			{
				modService.getData(modService.data.map.provinces.image).then(function (data) {
					return modService.getImage(data);
				}).then(function (image) {
					$scope.scrollImage = image.src;
					$scope.mapWidth = image.width;
					$scope.mapHeight = image.height;
					return syncMapCanvasDimensions(image).then(function () {
						mapDrawService.clearCanvas($scope.mapCanvas);
						mapDrawService.drawCanvas($scope.mapCanvas);
						$scope.loading = false;
					});
				}).then(null, handleMapError);
			}
			else if (newValue == 'empty')
				renderEmptyView(environment).then(null, handleMapError);
			else if (newValue == 'seas')
			{
				modService.getData(modService.data.map.seas.image).then(function (data) {
					return modService.getImage(data);
				}).then(function (image) {
					$scope.scrollImage = image.src;
					$scope.mapWidth = image.width;
					$scope.mapHeight = image.height;
					return syncMapCanvasDimensions(image).then(function () {
						mapDrawService.clearCanvas($scope.mapCanvas);
						$scope.loading = false;
					});
				}).then(null, handleMapError);
			}
			else if (newValue == 'countries')
			{
				modService.getData(modService.data.map.environment).then(function (dataNode) {
					mapDrawService.colorCanvas($scope.mapCanvas, [200, 200, 200, 255]);
					// CK2
					if (dataNode.default.data.sea_zones)
					{
						for (var i; i < dataNode.default.data.sea_zones.length; i++)
							mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.sea_zones[i], [51, 157, 255, 255], true);
					}
					if (dataNode.default.data.major_rivers)
						mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.major_rivers, [6, 115, 249, 255], true);
					// EU4
					if (dataNode.default.data.sea_starts)
						mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.sea_starts, [51, 157, 255, 255], true);
					if (dataNode.default.data.lakes)
						mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.lakes, [6, 115, 249, 255], true);

					//mapDrawService.fillProvinces($scope.mapCanvas, []);
				}).then(function () {
					return modService.getData(modService.data.countries.tags).then(function (countryTags) {
						return modService.getData(modService.data.history.provinces).then(function (provinces) {
							return modService.getData(modService.data.countries.info).then(function (countries) {

								angular.forEach(provinces.byId, function (province) {
									if (province._country)
									{
										mapDrawService.fillProvinces($scope.mapCanvas, [province], [province._country.data.data.color[0], province._country.data.data.color[1], province._country.data.data.color[2], 255], true);
									}
								})

								return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
									$scope.loading = false;
								});
							});
						});
					});
				}, handleMapError);
			}
			else if (newValue == 'countryReligion')
			{
				modService.getData(modService.data.map.environment).then(function (dataNode) {
					mapDrawService.colorCanvas($scope.mapCanvas, [200, 200, 200, 255]);
					// CK2
					if (dataNode.default.data.sea_zones)
					{
						for (var i; i < dataNode.default.data.sea_zones.length; i++)
							mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.sea_zones[i], [51, 157, 255, 255], true);
					}
					if (dataNode.default.data.major_rivers)
						mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.major_rivers, [6, 115, 249, 255], true);
					// EU4
					if (dataNode.default.data.sea_starts)
						mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.sea_starts, [51, 157, 255, 255], true);
					if (dataNode.default.data.lakes)
						mapDrawService.fillProvinces($scope.mapCanvas, dataNode.default.data.lakes, [6, 115, 249, 255], true);

					//mapDrawService.fillProvinces($scope.mapCanvas, []);
				}).then(function () {
					return modService.getData(modService.data.countries.tags).then(function (countryTags) {
						return modService.getData(modService.data.history.provinces).then(function (provinces) {
							return modService.getData(modService.data.countries.info).then(function (countries) {

								angular.forEach(provinces.byId, function (province) {
									if (province._country)
									{
										mapDrawService.fillProvinces($scope.mapCanvas, [province], [province._country.data.data.color[0], province._country.data.data.color[1], province._country.data.data.color[2], 255], true);
									}
								})

								return mapDrawService.fillProvinces($scope.mapCanvas, []).then(function () {
									$scope.loading = false;
								});
							});
						});
					});
				}, handleMapError);
			}
			else if (newValue == 'baseTax')
				renderProvinceValueView(environment, 'base_tax', 'Base Tax').then(null, handleMapError);
			else if (newValue == 'baseManpower')
				renderProvinceValueView(environment, 'base_manpower', 'Base Manpower').then(null, handleMapError);
			else if (newValue == 'baseProduction')
				renderProvinceValueView(environment, 'base_production', 'Base Production').then(null, handleMapError);
			else if (newValue == 'development')
				renderProvinceValueView(environment, 'development', 'Development').then(null, handleMapError);
			else if (newValue == 'religion' || newValue == 'government'
				|| newValue == 'culture' || newValue == 'tradeGoods')
				renderCategoryView(environment, newValue).then(null, handleMapError);
			else if (newValue == 'climate' || newValue == 'weather' || newValue == 'monsoons')
				renderEnvironmentView(environment, newValue).then(null, handleMapError);
			else if (newValue == 'provinceTerrain')
				renderProvinceTerrainView(environment).then(null, handleMapError);

			if ($scope.options.highLight)
			{
				$scope.options.highLight = false;
				$scope.options.highLight = true;

				modService.getData(modService.data.map.provinceMapping).then(function (dataNode) {
					$scope.areaByProvinceId = dataNode.areaByProvinceId;
				}, handleMapError);
			}
		}, handleMapError);
	});

	$scope.loadEnvironmentData = function () {
		$scope.loading = true;
		return modService.loadMapEnvironment(['default', 'climate', 'continent', 'region', 'area', 'terrain']).then(function (environment) {
			return loadProvinceTerrain(environment).then(function (terrainState) {
				$scope.regionOptions = [{value: '', label: 'No region'}];
				angular.forEach(environment.region && environment.region.subNodes || [], function (region) {
					$scope.regionOptions.push({value: region.name, label: region.name.replace(/_/g, ' ')});
				});
				$scope.environmentDataAvailable = {
					_continent: !!environment.continent,
					_climate: !!environment.climate,
					_winter: !!environment.climate,
					_monsoon: !!environment.climate,
					_isSeaStart: !!(environment.default && environment.default.data.sea_starts),
					_isLake: !!(environment.default && environment.default.data.lakes),
					_isForcedCoastal: !!(environment.default && environment.default.data.force_coastal),
					_regions: !!(environment.region && environment.area),
					_terrain: !!(terrainState && terrainState.available),
				};
				return $scope.refreshSelection().then(function () {
					$scope.loading = false;
				});
			});
		}).then(null, handleMapError);
	};
	$scope.$watch('dataViewLeft.type', function (type) {
		if (type == 'multiEnvironment')
			$scope.loadEnvironmentData();
	});

	var gridImageRequest = 0;
	$scope.$watch('[options.showGrid, view]', function(newValue, oldValue) {
		var request = ++gridImageRequest;
		var requestedView = $scope.view;
		if ($scope.options.showGrid)
		{
			var source = modService.data.map.provinces.grid;
			if ($scope.view == 'seas')
				source = modService.data.map.seas.grid;

			$scope.loading = true;
			modService.getData(source).then(function (data) {
				return modService.getImage(data);
			}).then(function (image) {
				if (request != gridImageRequest || !$scope.options.showGrid || $scope.view != requestedView)
					return;
				$scope.gridImage = image.src;
				$scope.loading = false;

			}, function (error) {
				if (request == gridImageRequest)
					handleMapError(error);
			});
		}
		else
		{
			$scope.gridImage = null;
		}
	});
	var highlightDataRequest = 0;
	$scope.$watch('[options.highLight, view]', function(newValue, oldValue) {
		var request = ++highlightDataRequest;
		var requestedView = $scope.view;
		if ($scope.options.highLight)
		{
			var source = modService.data.map.provinces.info;
			if ($scope.view == 'seas')
				source = modService.data.map.seas.info;

			$scope.loading = true;
			modService.getData(source).then(function (dataNode) {
				if (request != highlightDataRequest || !$scope.options.highLight || $scope.view != requestedView)
					return;
				$scope.analytics = dataNode.analytics;
				$scope.loading = false;
			}, function (error) {
				if (request == highlightDataRequest)
					handleMapError(error);
			});
		}
		else
		{
			$scope.analytics = null;
		}
	});

	var labelViewRequest = 0;
	var getOptionalLabelData = function (path, dataNode) {
		return modService.getFileEntry(path, null, true, true).then(function (entry) {
			if (!entry)
			{
				console.info('[map-analysis] Missing optional label data: '+ path);
				return null;
			}
			return modService.getData(dataNode);
		});
	};
	var getCountryHistoryByTag = function (tags) {
		if (!tags.length)
			return $q.when({});

		return modService.getFileEntry('history/countries', null, true, true).then(function (entry) {
			if (!entry)
			{
				console.info('[map-analysis] Missing optional label data: history/countries');
				return {};
			}

			return modService.getFileNodeByPath('history/countries').then(function (directory) {
				return modService.loadFileNodeDirectory(directory);
			}).then(function (directory) {
				var pathsByTag = {};
				angular.forEach(directory.files, function (file) {
					var match = /^([A-Z0-9]{3})(?:\s|\.|$)/i.exec(file.name);
					if (match && !pathsByTag[match[1].toUpperCase()])
						pathsByTag[match[1].toUpperCase()] = file.path;
				});

				var promisesByTag = {};
				angular.forEach(tags, function (tag) {
					var path = pathsByTag[tag.toUpperCase()];
					if (path)
					{
						promisesByTag[tag] = modService.getPdxScriptDataByPath(path).then(function (node) {
							return node.data && node.data.data || {};
						});
					}
				});
				return $q.all(promisesByTag);
			});
		});
	};
	var getLocalizedLabel = function (localisation, key) {
		var english = localisation && localisation.byLanguage
			&& localisation.byLanguage.l_english;
		var value = english && english[key];
		return value ? (value._text || value.toString()) : '';
	};

	$scope.$watch('labelView', function (newValue) {
		var request = ++labelViewRequest;
		$scope.labels = [];
		if (newValue == 'none')
			return;

		var needsProvinceHistory = newValue != 'provinceId';
		var needsLocalisation = newValue == 'provinceName' || newValue == 'countryName'
			|| newValue == 'countryReligion' || newValue == 'countryGovernment';
		var needsCountryHistory = newValue == 'countryReligion' || newValue == 'countryGovernment';
		var dataPromises = {
			areas: modService.getData(modService.data.map.areas),
			provinceMapping: modService.getData(modService.data.map.provinceMapping),
			colorMapping: modService.getData(modService.data.map.colorMapping),
			provinces: needsProvinceHistory
				? getOptionalLabelData('history/provinces', modService.data.history.provinces)
				: $q.when(null),
			localisation: needsLocalisation
				? getOptionalLabelData('localisation', modService.data.localisation)
				: $q.when(null),
		};

		$q.all(dataPromises).then(function (data) {
			var mappingsByAreaColor = {};
			angular.forEach(data.provinceMapping.areaByProvinceId, function (area, provinceId) {
				if (area && !mappingsByAreaColor[area.colorNum])
				{
					mappingsByAreaColor[area.colorNum] = {
						id: String(provinceId),
						mapping: data.colorMapping.byId[provinceId]
					};
				}
			});

			var areas = [];
			var countryTags = [];
			angular.forEach(data.areas.list, function (area) {
				var colorMapping = data.colorMapping.byColor[area.colorNum];
				var fallbackMapping = mappingsByAreaColor[area.colorNum];
				var mapping = colorMapping || fallbackMapping && fallbackMapping.mapping;
				var provinceId = mapping ? String(mapping.id) : fallbackMapping && fallbackMapping.id;
				var province = provinceId && data.provinces && data.provinces.byId[provinceId];
				var owner = getProvinceState(province).owner;

				if (owner && countryTags.indexOf(owner) == -1)
					countryTags.push(owner);
				areas.push({
					area: area,
					provinceId: provinceId,
					mapping: mapping,
					province: province,
					owner: owner
				});
			});

			var countryHistoryPromise = needsCountryHistory
				? getCountryHistoryByTag(countryTags)
				: $q.when({});
			return countryHistoryPromise.then(function (countryHistory) {
				if (request != labelViewRequest || newValue != $scope.labelView)
					return;

				var labels = [];
				angular.forEach(areas, function (entry) {
					var area = entry.area;
					var provinceId = entry.provinceId;
					var text = '';
					var ownerLabel = entry.owner || (entry.province ? 'Unowned' : 'Owner unavailable');

					if (newValue == 'provinceName')
					{
						text = getLocalizedLabel(data.localisation, 'PROV'+ provinceId)
							|| entry.mapping && entry.mapping.name
							|| (provinceId ? 'Province '+ provinceId : '');
					}
					else if (newValue == 'provinceId')
						text = provinceId || 'Unmapped province (RGB '+ area.r +', '+ area.g +', '+ area.b +')';
					else if (newValue == 'countryTag')
						text = ownerLabel;
					else if (newValue == 'countryName')
						text = entry.owner
							? getLocalizedLabel(data.localisation, entry.owner) || entry.owner
							: ownerLabel;
					else if (newValue == 'countryReligion' || newValue == 'countryGovernment')
					{
						var attribute = newValue == 'countryReligion' ? 'religion' : 'government';
						var country = entry.owner && countryHistory[entry.owner];
						var value = country && country[attribute];
						text = value
							? getLocalizedLabel(data.localisation, value) || String(value)
							: entry.owner ? entry.owner +' ('+ attribute +' unavailable)' : ownerLabel;
					}

					if (!text)
						text = 'Unmapped province (RGB '+ area.r +', '+ area.g +', '+ area.b +')';

					labels.push({
						x: area.center[0],
						y: area.center[1],
						width: 0,
						height: 0,
						area: area,
						text: text,
						message: provinceId ? 'Province ID: '+ provinceId : 'No province ID mapping available.'
					});
				});
				$scope.labels = labels;
			});
		}).then(null, function (error) {
			if (request == labelViewRequest)
				handleMapError(error);
		});
	});

	$scope.loadSeasMap = function () {
		var renderSeaResults = function (seaEntries, showSeaMap, priorMessages, priorLabels) {
			$scope.output = '';
			$scope.messages = priorMessages || '';
			$scope.outputTitle = 'default.map - sea_starts()';
			$scope.labels = priorLabels || [];
			$scope.view = showSeaMap ? 'seas' : 'provinces';
			$scope.options.showLabels = true;

			var seaIds = [];
			angular.forEach(seaEntries, function (entry) {
				var id = parseInt(entry.mapping.id);
				if (isNaN(id))
					return;

				var area = entry.area;
				var center = entry.mapping.center || area.center;
				$scope.labels.push({
					text: entry.mapping.id,
					x: center[0],
					y: center[1],
					extentMin: area.extentMin,
					extentSize: area.extentSize,
					area: area
				});
				seaIds.push(id);
			});

			seaIds.sort(function (a, b) { return a - b; });
			for (var i = 0; i < seaIds.length; i++)
			{
				$scope.output += seaIds[i] +' ';
				if (i % 20 == 0 && i > 0)
					$scope.output += "\n";
			}

			$scope.messages += seaIds.length +' seas matched.'+"\n";
			$scope.loading = false;
		};

		$scope.loading = true;
		return modService.getFileEntry('map/seas.png', null, true).then(function (entry) {
			if (entry)
			{
				$scope.hasSeasPng = true;
				return modService.traceMapAnalysis('Analyze seas.png', function () {
					return $q.all({
						info: modService.getData(modService.data.map.seas.info),
						mappings: modService.getData(modService.data.map.colorMapping),
					}).then(function (data) {
						var seaEntries = [];
						var missingEntries = [];
						var missingMessages = '';
						for (var colorNum in data.info.analytics.colors)
						{
							if (!data.info.analytics.colors.hasOwnProperty(colorNum))
								continue;

							var area = data.info.analytics.colors[colorNum];
							var mapping = data.mappings.byColor[colorNum];
							if (!mapping)
							{
								var errorMessage = 'Sea nr '+ area.quadNr +' not found in definition.csv.'+"\n";
								missingMessages += errorMessage;
								missingEntries.push({
									text: area.quadNr,
									x: area.center[0],
									y: area.center[1],
									extentMin: area.extentMin,
									extentSize: area.extentSize,
									message: errorMessage,
									area: area
								});
								continue;
							}
							seaEntries.push({area: area, mapping: mapping});
						}

						renderSeaResults(seaEntries, true, missingMessages, missingEntries);
					});
				}).then(null, handleMapError);
			}

			console.info('[map-analysis] Missing optional file: map/seas.png; deriving sea provinces from map/default.map.');
			$scope.hasSeasPng = false;
			$scope.view = 'provinces';
			return modService.loadMapEnvironment(['default']).then(function (environment) {
				var seaStarts = environment.default && environment.default.data.sea_starts;
				if (!seaStarts || !seaStarts.length)
				{
					$scope.output = '';
					$scope.labels = [];
					$scope.outputTitle = 'Sea analysis unavailable';
					$scope.messages = 'Sea provinces could not be inferred: add map/seas.png or define sea_starts in map/default.map.';
					$scope.loading = false;
					return;
				}

				return $q.all({
					provinceMapping: modService.getData(modService.data.map.provinceMapping),
					colorMapping: modService.getData(modService.data.map.colorMapping),
				}).then(function (data) {
					var seaEntries = [];
					angular.forEach(seaStarts, function (provinceId) {
						var id = parseInt(provinceId);
						var mapping = data.colorMapping.byId[id];
						var area = data.provinceMapping.areaByProvinceId[id];
						if (mapping && area)
							seaEntries.push({area: area, mapping: mapping});
					});

					renderSeaResults(seaEntries, false);
				});
			}).then(null, handleMapError);
		}, handleMapError);
	};

	$scope.loadNumberedMap = function () {
		var deferred = $q.defer();
		// We have to make this async, otherwise we get $apply hell
		$scope.loading = true;
		$scope.output = '';
		$scope.messages = '';
		$scope.outputTitle = '`definition.csv` from map';

		$scope.labels = [];

		$scope.view = 'provinces';
		$scope.dataViewLeft.type = 'output';
		$scope.options.showLabels = true;

		return modService.traceMapAnalysis('Analyze provinces.bmp', function () {
			return $q.all({
				info: modService.getData(modService.data.map.provinces.info),
				colorMapping: modService.getData(modService.data.map.colorMapping),
				provinceMapping: modService.getData(modService.data.map.provinceMapping),
			}).then(function (data) {
				var defs = 'province;red;green;blue;x;x' + "\n";
				$scope.labels = [];
				var mappingByAreaColor = {};
				angular.forEach(data.provinceMapping.areaByProvinceId, function (area, provinceId) {
					var mapping = data.colorMapping.byId[provinceId];
					if (area && mapping)
						mappingByAreaColor[area.colorNum] = mapping;
				});

				var firstArea;
				angular.forEach(data.info.analytics.quadNrs, function (color) {
					if (!color)
						return;

					firstArea = color;

					var mapping = data.colorMapping.byColor[color.colorNum] || mappingByAreaColor[color.colorNum];
					var labelText = mapping && mapping.name
						? mapping.name
						: mapping ? 'Province '+ mapping.id : 'Unmapped province (RGB '+ color.r +', '+ color.g +', '+ color.b +')';
					var labelMessage = mapping
						? 'Province ID: '+ mapping.id
						: 'No matching row in map/definition.csv.';
					$scope.labels.push({
						text: labelText,
						x: color.center[0],
						y: color.center[1],
						extentMin: color.extentMin,
						extentSize: color.extentSize,
						area: color,
						message: labelMessage
					});

					defs += color.quadNr +';'+ color.r +';'+ color.g +';'+ color.b +';?;'+ color.center[0] + ',' + color.center[1] +"\n";
				});
				$scope.output = defs;

				$scope.loading = false;
			});
		}).then(null, handleMapError);
	};

	$scope.startDown = null;
	$scope.toggleAreaDown = function (event) {
		$scope.startDown = event;
	};

	$scope.toggleAreaUp = function (event) {
		if ($scope.startDown)
		{
			var diff = ($scope.startDown.pageX + $scope.startDown.pageY) - (event.pageX + event.pageY);
			$scope.startDown = null;

			// We are not multi-selecting & we've moved - don't trigger 'click'
			if (!event.ctrlKey && (diff > 10 || diff < -10))
				return;
		}
		if ($scope.analytics && $scope.options.selectArea && event.button == 0)
		{
			var coordinates = getMapCoordinates(event);
			if (!coordinates)
				return;
			return modService.getData(modService.data.map.provinceMapping).then(function (dataNode) {
				var area = mapDrawService.getAreaFromCoords($scope.analytics, coordinates.x, coordinates.y);
				if (!area)
					return;
				var provinceId = dataNode.areaByProvinceId.indexOf(area);
				if (provinceId <= 0)
					return;

				if (!event.ctrlKey)
				{
					// Select one
					$scope.selectedAreas.length = 0;
					for (var i = 0; i < $scope.selectedProvinces.length; i++)
						mapDrawService[$scope.selectEffectClear]($scope.selectCanvas, $scope.selectedProvinces[i], [0, 0, 0, 0]);
					$scope.selectedProvinces.length = 0;
				}

				var index = $scope.selectedAreas.indexOf(area);
				if (index != -1)
					$scope.selectedAreas.splice(index, 1);
				else
					$scope.selectedAreas.push(area);

				var index = $scope.selectedProvinces.indexOf(provinceId);
				if (index != -1)
				{
					$scope.selectedProvinces.splice(index, 1);
					mapDrawService[$scope.selectEffectClear]($scope.selectCanvas, provinceId, [0, 0, 0, 0]);
				}
				else
				{
					$scope.selectedProvinces.push(provinceId);
					mapDrawService[$scope.selectEffect]($scope.selectCanvas, provinceId, [128, 0, 0, 256]);
				}

				return $scope.refreshSelection();
			}, handleMapError);
		}
	};

	var refreshSelectionRequest = 0;
	$scope.refreshSelection = function () {
		var request = ++refreshSelectionRequest;
		var selectedProvinceIds = $scope.selectedProvinces.slice();
		$scope.dataViewLeft.multiProvinces = selectedProvinceIds;

		if (!selectedProvinceIds.length)
		{
			$scope.dataViewInfo.province = null;
			$scope.dataViewInfo.provinceName = '';
			$scope.dataViewInfo.ownerTag = '';
			$scope.dataViewInfo.countryName = '';
			$scope.dataViewInfo.country = null;
			$scope.dataViewInfo.provinceText = '';
			$scope.dataViewLeft.multiProvince = {
				data: {},
				multiData: {},
				provinces: [],
				provinceIds: [],
				provinceNames: [],
				hasData: {},
			};
			$scope.selectedProvinceHistory = null;
			return $q.when();
		}

		var selectionPromise = $q.all({
			provinces: modService.getData(modService.data.history.provinces),
			provinceMapping: modService.getData(modService.data.map.provinceMapping),
			colorMapping: modService.getData(modService.data.map.colorMapping),
			localisation: getOptionalLabelData('localisation', modService.data.localisation),
			terrain: loadProvinceTerrain(),
		}).then(function (data) {
			var provinceId = selectedProvinceIds[0];
			var province = data.provinces.byId[provinceId];
			var ownerTag = getProvinceState(province).owner || '';
			var countryDataPromise = ownerTag
				? $q.all({
					tags: getOptionalLabelData('common/country_tags', modService.data.countries.tags),
					countries: getOptionalLabelData('common/countries', modService.data.countries.info),
				})
				: $q.when({tags: null, countries: null});

			var provinceTextPromise = province && !province._isFallback
				? modService.getFileText(province.file.path)
				: $q.when('');

			return $q.all({
				countryData: countryDataPromise,
				provinceText: provinceTextPromise,
			}).then(function (loaded) {
				if (request != refreshSelectionRequest
					|| selectedProvinceIds.join(',') != $scope.selectedProvinces.join(','))
					return;

				if (loaded.countryData.tags && loaded.countryData.countries)
					modService.linkCountryInfo(loaded.countryData.countries);
				if (data.localisation)
					modService.linkLocalisation(data.localisation);

				var countryTag = ownerTag && loaded.countryData.tags
					? loaded.countryData.tags.byTag[ownerTag] : null;
				var country = countryTag && countryTag.value && loaded.countryData.countries
					? loaded.countryData.countries.byPath['common/'+ countryTag.value] : null;
				if (province)
					province._country = country || null;

				var provinceMapping = data.colorMapping.byId[provinceId];
				var englishLocalisation = data.localisation && data.localisation.byLanguage.l_english;
				var provinceLocalisation = englishLocalisation && englishLocalisation['PROV'+ provinceId];
				var countryLocalisation = englishLocalisation && englishLocalisation[ownerTag];
				var countryFallbackName = country && country.file
					? (country.file.baseName || country.file.name).replace(/^[A-Z0-9]{3}\s*-\s*/, '')
					: ownerTag || 'Unowned';
				$scope.dataViewInfo.province = province;
				$scope.dataViewInfo.provinceName = provinceLocalisation
					? provinceLocalisation._text || provinceLocalisation.toString()
					: provinceMapping && provinceMapping.name || String(provinceId);
				$scope.dataViewInfo.ownerTag = ownerTag;
				$scope.dataViewInfo.countryName = countryLocalisation
					? countryLocalisation._text || countryLocalisation.toString()
					: countryFallbackName;
				$scope.dataViewInfo.country = country;
				$scope.dataViewInfo.provinceText = loaded.provinceText;

				var multiProvince = {
					data: {},
					multiData: {},
					provinces: [],
					provinceIds: [],
					provinceNames: [],
					hasData: {},
				};
				var environmentAvailability = {
					_climate: $scope.environmentDataAvailable && $scope.environmentDataAvailable._climate,
					_winter: $scope.environmentDataAvailable && $scope.environmentDataAvailable._winter,
					_monsoon: $scope.environmentDataAvailable && $scope.environmentDataAvailable._monsoon,
					_regions: $scope.environmentDataAvailable && $scope.environmentDataAvailable._regions,
					_terrain: $scope.environmentDataAvailable && $scope.environmentDataAvailable._terrain,
				};

				angular.forEach(selectedProvinceIds, function (selectedProvinceId) {
					var selectedProvince = data.provinces.byId[selectedProvinceId];
					if (!selectedProvince)
						return;

					multiProvince.provinces.push(selectedProvince);
					multiProvince.provinceIds.push(selectedProvinceId);
					var nameLocalisation = englishLocalisation && englishLocalisation['PROV'+ selectedProvinceId];
					var nameMapping = data.colorMapping.byId[selectedProvinceId];
					multiProvince.provinceNames.push(nameLocalisation
						? nameLocalisation._text || nameLocalisation.toString()
						: nameMapping && nameMapping.name || String(selectedProvinceId));

					angular.forEach(getProvinceState(selectedProvince), function (value, key) {
						if (!multiProvince.multiData[key])
							multiProvince.multiData[key] = [];
						multiProvince.multiData[key].push(value);

						if (multiProvince.data[key] == undefined)
							multiProvince.data[key] = value;
						else if (multiProvince.data[key] != value)
							multiProvince.data[key] = null;

						if (multiProvince.multiData[key].length != multiProvince.provinces.length)
							multiProvince.data[key] = null;

						multiProvince.hasData[key] = multiProvince.data[key] != null
							&& multiProvince.data[key] != undefined;
					});

					angular.forEach(selectedProvince, function (value, key) {
						if (key[0] != '_' || (angular.isObject(value) && !('_type' in value)))
							return;
						if (!multiProvince.multiData[key])
							multiProvince.multiData[key] = [];

						var displayValue = value;
						if (angular.isObject(value))
						{
							if (value._type == 'boolean')
								displayValue = 1;
							else if (value._type == 'namedSet' || value._type == 'classification')
								displayValue = value._value !== undefined ? value._value : value.name;
							else if (value._type == 'multipleNamed')
							{
								if (key == '_regions')
									displayValue = value.length ? value[0].name : '';
								else
								{
									displayValue = [];
									for (var i = 0; i < value.length; i++)
										displayValue.push(value[i].name);
									displayValue.sort();
								}
							}
						}
						multiProvince.multiData[key].push(displayValue);

						if (multiProvince.data[key] === undefined)
							multiProvince.data[key] = displayValue;
						else if (multiProvince.data[key] != displayValue)
							multiProvince.data[key] = null;

						if (multiProvince.multiData[key].length != multiProvince.provinces.length)
							multiProvince.data[key] = null;

						if (Object.prototype.hasOwnProperty.call(environmentAvailability, key))
							multiProvince.hasData[key] = !!environmentAvailability[key];
						else
							multiProvince.hasData[key] = multiProvince.data[key] != null
								&& multiProvince.data[key] != undefined;
					});
				});

				multiProvince.hasData._terrain = !!environmentAvailability._terrain
					&& multiProvince.provinces.every(function (selectedProvince) {
						return !!selectedProvince._terrain;
					});
				$scope.dataViewLeft.multiProvince = multiProvince;
				if (selectedProvinceIds.length > 1)
				{
					if ($scope.dataViewLeft.type == 'province')
						$scope.dataViewLeft.type = 'multiProvince';
				}
				else if ($scope.dataViewLeft.type == 'multiProvince')
					$scope.dataViewLeft.type = 'province';
			});
		});
		return selectionPromise.then(null, function (error) {
			if (request == refreshSelectionRequest)
				handleMapError(error);
		});
	};

	$scope.hoverArea = null;
	var hoverLookupRequest = 0;
	$scope.toggleAreaHover = function (event) {
		if (!$scope.analytics)
			return;

		// Undo ctrl-effect if window had lost focus
		if (!event.ctrlKey && !$rootScope.panzoomConfig.panOnClickDrag)
			$rootScope.panzoomConfig.panOnClickDrag = true;

		if ($scope.startDown)
		{
			var diff = ($scope.startDown.pageX + $scope.startDown.pageY) - (event.pageX + event.pageY);

			if (diff > 5 || diff < -5)
				return;
		}

		var coordinates = getMapCoordinates(event);
		var currentArea = coordinates
			? mapDrawService.getAreaFromCoords($scope.analytics, coordinates.x, coordinates.y)
			: null;

		if (currentArea != $scope.hoverArea)
		{
			var request = ++hoverLookupRequest;

			// Remove current
			if ($scope.hoverArea)
			{
				mapDrawService[$scope.hoverEffectClear]($scope.hoverCanvas, $scope.hoverArea, [0, 0, 0, 0]);
				$scope.hoverArea._hovered = false;
			}

			// Highlight new
			$scope.hoverArea = currentArea;
			if (!currentArea)
			{
				$scope.mapHint = '';
				$scope.hoveredProvinceHistory = null;
			}
			else
			{
				$scope.hoverArea._hovered = true;
				mapDrawService[$scope.hoverEffect]($scope.hoverCanvas, currentArea, [0, 0, 128, 256]);
				modService.getProvinceByArea(currentArea).then(function (province) {
					if (request != hoverLookupRequest || currentArea != $scope.hoverArea)
						return;
					if (province)
						$scope.mapHint = province.file.baseName;
					else
						$scope.mapHint = '';
					$scope.hoveredProvinceHistory = province;
				});
			}
		}
	};

	$scope.saveDataNode = function (dataNode, additionalSave) {
		var savePromises = [modService.saveData(dataNode)];
		if (additionalSave)
			savePromises.push(additionalSave);
		return $q.all(savePromises).then(function () {
			if ($scope.labelView != 'none')
			{
				var currentView = $scope.labelView;
				$scope.labelView = 'none';
				$timeout(function() {
					$scope.labelView = currentView;
				});
			}
			if ($scope.view != 'none')
			{
				var currentView = $scope.view;
				$scope.view = 'none';
				$timeout(function() {
					$scope.view = currentView;
				});
			}
			return $scope.refreshSelection();
		}, handleMapError);
	};
	$scope.saveProvinceDetails = function () {
		var province = $scope.dataViewInfo.province;
		if (!province)
			return $q.when();
		angular.forEach(province._effectiveEdits, function (isEdited, key) {
			if (isEdited)
				modService.setProvinceHistoryValue(province, key, getProvinceState(province)[key]);
		});
		return $scope.saveDataNode(province, saveProvinceTerrain([province])).then(function () {
			province._effectiveEdits = {};
			if (province._isFallback)
				province._isFallback = false;
		});
	};
	$scope.markProvinceHistoryFieldEdited = function (key) {
		var province = $scope.dataViewInfo.province;
		if (!province)
			return;
		if (!province._effectiveEdits)
			province._effectiveEdits = {};
		province._effectiveEdits[key] = true;
	};
	$scope.saveCountryName = function () {
		var countryName = ($scope.dataViewInfo.countryName || '').trim();
		var countryTag = $scope.dataViewInfo.ownerTag;
		if (!countryTag || !countryName)
		{
			handleMapError(new Error('A country tag and non-empty country name are required.'));
			return $q.when();
		}

		var localisation = modService.data.localisation;
		var currentEntry = localisation.byLanguage.l_english && localisation.byLanguage.l_english[countryTag];
		if (currentEntry)
		{
			currentEntry._text = countryName;
			return $scope.saveDataNode(currentEntry._node);
		}

		var targetFile = null;
		angular.forEach(localisation.byFile, function (yamlNode, path) {
			if (!targetFile && /_l_english\.yml$/i.test(path))
				targetFile = yamlNode;
		});
		if (!targetFile)
		{
			handleMapError(new Error('No English localization YAML file is available to save the country name.'));
			return $q.when();
		}

		if (!targetFile.data)
			targetFile.data = {};
		if (!targetFile.data.l_english)
			targetFile.data.l_english = {};
		var localisationKey = countryTag + ':0';
		var entry = new String(countryName);
		entry._text = countryName;
		entry._node = targetFile;
		targetFile.data.l_english[localisationKey] = entry;
		if (!localisation.byId[countryTag])
			localisation.byId[countryTag] = {};
		localisation.byId[countryTag].l_english = entry;
		localisation.byId[localisationKey] = {l_english: entry};
		if (!localisation.byLanguage.l_english)
			localisation.byLanguage.l_english = {};
		localisation.byLanguage.l_english[countryTag] = entry;
		localisation.byLanguage.l_english[localisationKey] = entry;
		if (localisation.languages.indexOf('l_english') == -1)
			localisation.languages.push('l_english');
		if ($scope.dataViewInfo.province && $scope.dataViewInfo.province._country
			&& $scope.dataViewInfo.province._country._tag)
			$scope.dataViewInfo.province._country._tag._localisation = localisation.byId[countryTag];

		return $scope.saveDataNode(targetFile);
	};

	$scope.saveMultiDataNode = function (multiData) {
		var environmentData = modService.data.map.environment;
		var saveNodes = [];
		var terrainProvinces = [];
		var environmentChanged = false;
		var addSaveNode = function (node) {
			if (node && saveNodes.indexOf(node) == -1)
				saveNodes.push(node);
		};

		try
		{
			angular.forEach(multiData.provinces, function (province) {
				angular.forEach(multiData.hasData, function (hasValue, key) {
					if (!hasValue)
						return;

					if (key == '_climate' || key == '_winter' || key == '_monsoon')
					{
						var classification = multiData.data[key];
						if (classification === null || classification === undefined)
							return;
						environmentChanged = modService.setProvinceClassification(province, key, classification) || environmentChanged;
					}
					else if (key == '_terrain')
					{
						if (multiData.data[key] === null || multiData.data[key] === undefined)
							return;
						if (!province._terrain)
							throw new Error('Province terrain data is unavailable for province ' + province._id + '.');
						province._terrain._value = multiData.data[key];
						terrainProvinces.push(province);
					}
					else if (key == '_regions')
					{
						if (multiData.data[key] === null || multiData.data[key] === undefined)
							return;
						var selectedRegion = multiData.data[key];
						environmentChanged = modService.updateProvinceRegions(province, selectedRegion ? [selectedRegion] : []) || environmentChanged;
					}
					else if (key[0] == '_')
					{
						var environmentField = environmentData[key];
						if (!environmentField)
							return;

						if (environmentField._type == 'boolean')
						{
							var provinceIndex = environmentField._provinces.indexOf(province);
							if (provinceIndex == -1 && multiData.data[key])
							{
								environmentField._provinces.push(province);
								province[key] = environmentField;
								environmentChanged = true;
							}
							else if (provinceIndex != -1 && !multiData.data[key])
							{
								environmentField._provinces.splice(provinceIndex, 1);
								province[key] = null;
								environmentChanged = true;
							}
						}
						else if (environmentField._type == 'namedSet')
						{
							if (province[key])
							{
								var oldIndex = province[key]._provinces.indexOf(province);
								if (oldIndex != -1)
									province[key]._provinces.splice(oldIndex, 1);
							}

							var node = environmentField._nodeByName[multiData.data[key]];
							if (node && node._provinces.indexOf(province) == -1)
								node._provinces.push(province);
							province[key] = node || null;
							environmentChanged = true;
						}
						else if (environmentField._type == 'multipleNamed' && typeof multiData.data[key] == 'string')
						{
							var values = multiData.data[key].split(' ');
							for (var i = 0; i < values.length; i++)
							{
								var operator = values[i][0];
								var value = values[i].substr(1);
								if (operator != '+' && operator != '-')
								{
									operator = '+';
									value = values[i];
								}
								if (!value)
									continue;

								var namedNode = environmentField._nodeByName[value];
								if (!namedNode)
								{
									namedNode = {type: 'property', name: value, value: []};
									environmentField.data[namedNode.name] = namedNode.value;
									namedNode._provinces = [];
									namedNode._node = environmentField._node;
									environmentField._nodeByName[namedNode.name] = namedNode;
								}

								var namedIndex = namedNode._provinces.indexOf(province);
								if (operator == '+' && namedIndex == -1)
									namedNode._provinces.push(province);
								else if (operator == '-' && namedIndex != -1)
									namedNode._provinces.splice(namedIndex, 1);
							}
							environmentChanged = true;
						}
					}
					else if (getProvinceState(province)[key] != multiData.data[key])
					{
						modService.setProvinceHistoryValue(province, key, multiData.data[key]);
						addSaveNode(province);
					}
				});
			});
		}
		catch (error)
		{
			handleMapError(error);
			return $q.when();
		}

		if (environmentChanged)
			addSaveNode(environmentData);

		var promises = [];
		angular.forEach(saveNodes, function (node) {
			promises.push(modService.saveData(node));
		});
		if (terrainProvinces.length)
			promises.push(saveProvinceTerrain(terrainProvinces));
		return $q.all(promises).then(function () {
			if ($scope.labelView != 'none')
			{
				var currentView = $scope.labelView;
				$scope.labelView = 'none';
				$timeout(function() {
					$scope.labelView = currentView;
				});
			}
			if ($scope.view != 'none')
			{
				var currentView = $scope.view;
				$scope.view = 'none';
				$timeout(function() {
					$scope.view = currentView;
				});
			}
			return $scope.refreshSelection();
		}, handleMapError);
	};


	$scope.compareWithDefinitions = function () {
		$scope.loading = true;
		$scope.output = '';
		$scope.messages = '';
		$scope.outputTitle = 'Merged `definition.csv`';
		$scope.labels = [];

		$scope.options.showLabels = true;
		$scope.view = 'provinces';
		$scope.dataViewLeft.type = 'output';

		$scope.messages = '';

		return modService.traceMapAnalysis('Compare with current', function () {
			return $q.all({
				mappings: modService.getData(modService.data.map.colorMapping),
				info: modService.getData(modService.data.map.provinces.info),
			}).then(function (data) {
				var mappings = data.mappings.byColor;
				var mapColors = data.info.analytics.colors;
				var mappingsByColor = {};
				for (var mappingId in data.mappings.byId)
				{
					if (data.mappings.byId.hasOwnProperty(mappingId))
					{
						var mapping = data.mappings.byId[mappingId];
						if (!mappingsByColor[mapping.colorNum])
							mappingsByColor[mapping.colorNum] = [];
						mappingsByColor[mapping.colorNum].push(mapping);
					}
				}

				var fallbackAreasByColor = mapAnalyzeService.findUniqueColorFallbacks(mappingsByColor, mapColors);

				// Iterate over current mapping
				for (var colorNum in mappings)
				{
					if (mappings.hasOwnProperty(colorNum))
					{
						var matchedArea = mapColors[colorNum] || fallbackAreasByColor[colorNum];
						if (!matchedArea)
						{
							// Color no longer present in map

							//$scope.messages += 'Mapping '+ mappings[colorNum].id +' no longer exists.' + "\n";

							var closest = null;
							var closestDistance = 0;
							for (var mapColorNum in mapColors)
							{
								if (mapColors.hasOwnProperty(mapColorNum) && !mapColors[mapColorNum].matched && !mappings[mapColorNum] && mappings[colorNum].center)
								{
									distance = Victor.fromArray(mappings[colorNum].center).distance(Victor.fromArray(mapColors[mapColorNum].center));

									if (closest == null || distance < closestDistance)
									{
										closest = mapColors[mapColorNum];
										closestDistance = distance;
									}
								}
							}

							if (closest && closestDistance < $scope.closestArea)
							{
								mappings[colorNum].matched = closest;
								mappings[colorNum].matchDistance = closestDistance;
								closest.matched = mappings[colorNum];
								var msg = 'Missing mapping '+ mappings[colorNum].id +' ('+ mappings[colorNum].name +') matched to closest new color '+ closest.quadNr +' at distance '+ closestDistance + ".\n";
								$scope.labels.push({text: closest.quadNr, x: closest.center[0], y: closest.center[1], extentMin: closest.extentMin, extentSize: closest.extentSize, message: msg});
								$scope.messages += msg;
							}
							else
							{
								$scope.messages += 'Mapping '+ mappings[colorNum].id +' ('+ mappings[colorNum].name +') no longer exists.' + "\n";
							}
						}
						else
						{
							// Color present in map
							mappings[colorNum].matched = matchedArea;
							matchedArea.matched = mappings[colorNum];

							var msg = null;
							$scope.labels.push({text: matchedArea.quadNr, x: matchedArea.center[0], y: matchedArea.center[1], extentMin: matchedArea.extentMin, extentSize: matchedArea.extentSize, message: msg, messageType: 'note'});
						}
					}
				}

				// Craft new definitions
				var defs = 'province;red;green;blue;x;x' + "\n";
				for (var id in data.mappings.byId)
				{
					if (data.mappings.byId.hasOwnProperty(id))
					{
						var m = data.mappings.byId[id];

						if (m.matched)
							defs += m.id +';'+ m.matched.r +';'+ m.matched.g +';'+ m.matched.b +';'+ (m.matchedDistance ? m.name +' (moved '+ matchDistance +')': m.name) +';'+ m.matched.center[0] + ',' + m.matched.center[1] +"\n";
						else
							defs += m.id +';'+ m.r +';'+ m.g +';'+ m.b +';'+ (m.name.replace(' (non-exist)', '') + ' (non-exist)') +';'+ m.center +"\n";
					}
				}

				var maxId = data.mappings.byId.length - 1;
				var stayedSame = 0;
				// find new, not matched colors, add 'hasMessage' markings
				for (var colorNum in mapColors)
				{
					if (mapColors.hasOwnProperty(colorNum))
					{
						var c = mapColors[colorNum];
						c.hasMessage = false;

						if (!c.matched)
						{
							maxId++;
							c.hasMessage = true;
							var msg = 'Color '+ maxId +' ('+ c.count +' pixels) is new.' + "\n";
							$scope.messages += msg;
							defs += maxId +';'+ c.r +';'+ c.g +';'+ c.b +';(new);'+ c.center[0] + ',' + c.center[1] +"\n";

							$scope.labels.push({text: maxId, x: c.center[0], y: c.center[1], extentMin: c.extentMin, extentSize: c.extentSize, message: msg});
						}
						else
							stayedSame++;
					}
				}
				$scope.messages += stayedSame +' entries stayed the same.';

				$scope.output = defs;
				$scope.loading = false;
			});
		}).then(null, modService.errorCallback);
	};
}]);

myMod.directive('sizeElement', function ($window, $timeout) {
	return {
		scope:true,
		priority: 0,
		link: function (scope, element) {
			var elementNode = element[0];
			var updateHeight = function () {
				var height = elementNode.getBoundingClientRect().height;
				if (!height || !isFinite(height) || Math.abs((scope.height || 0) - height) < 0.5)
					return;
				scope.$evalAsync(function () {
					scope.height = height;
				});
			};
			var resizeObserver = $window.ResizeObserver
				? new $window.ResizeObserver(updateHeight) : null;
			if (resizeObserver)
				resizeObserver.observe(elementNode);

			angular.element($window).on('resize', updateHeight);
			$timeout(updateHeight, 0, false);
			scope.$on('$destroy', function () {
				if (resizeObserver)
					resizeObserver.disconnect();
				angular.element($window).off('resize', updateHeight);
			});
		}
	};
});

//PanZoom
myMod.controller('PanZoom', ['$scope', 'PanZoomService', 'hotkeys', '$rootScope', function ($scope, PanZoomService, hotkeys, $rootScope) {

	// The panzoom config model can be used to override default configuration values
	$rootScope.panzoomConfig = $scope.panzoomConfig = {
		zoomLevels: 10,
		neutralZoomLevel: 5,
		initialZoomLevel: 0,
		scalePerZoomLevel: 2,
		zoomStepDuration: 0,
		invertMouseWheel: true,
		friction: 0,
		haltSpeed: 0,
		panOnClickDrag: true,
		//zoomOnMouseWheel: false
	};
	$scope.mapLabelLayerStyle = function (zoomLevel) {
		var config = $scope.panzoomConfig;
		var currentZoomLevel = isFinite(zoomLevel) ? zoomLevel : config.neutralZoomLevel;
		var maxZoomLevel = Math.max(1, config.zoomLevels - 1);
		var clampedZoomLevel = Math.max(0, Math.min(maxZoomLevel, currentZoomLevel));
		var minScreenFontSize = 6;
		var maxScreenFontSize = 14;
		var screenFontSize = minScreenFontSize
			+ (maxScreenFontSize - minScreenFontSize) * clampedZoomLevel / maxZoomLevel;
		var mapScale = Math.pow(config.scalePerZoomLevel, currentZoomLevel - config.neutralZoomLevel);
		return {'font-size': (screenFontSize / mapScale) +'px'};
	};

	hotkeys.bindTo($scope).add({
		combo: 'ctrl',
		description: 'Don\'t pan on map-drag.',
		action: 'keydown',
		callback: function (event, hotkey) {
			$scope.panzoomConfig.panOnClickDrag = false;
		},
	}).add({
		combo: 'ctrl',
		description: 'Don\'t pan on map-drag.',
		action: 'keyup',
		callback: function (event, hotkey) {
			$scope.panzoomConfig.panOnClickDrag = true;
		},
	});

	// The panzoom model should initialle be empty; it is initialized by the <panzoom>
	// directive. It can be used to read the current state of pan and zoom. Also, it will
	// contain methods for manipulating this state.
	$scope.panzoomModel = {};
}]);

// For navigation top bar
myMod.controller('TopBar', ['$scope', 'modService', function ($scope, modService) {
	$scope.manifest = chrome.runtime.getManifest();
	$scope.loadingStateText = '';

	$scope.$watch('modService.loadingState', function(newValue, oldValue) {
		$scope.loadingStateText = 'Loading: ';
		for (var p in newValue)
		{
			if (newValue.hasOwnProperty(p))
			{
				if (newValue[p])
					$scope.loadingStateText += p.replace('generate', '') +' ';
			}
		}
		if ($scope.loadingStateText == 'Loading: ')
			$scope.loadingStateText = '';
	}, true);
}]);

// About page
myMod.controller('AboutPage', ['$scope', function ($scope) {
	$scope.manifest = chrome.runtime.getManifest();
}]);

// Contents page
myMod.controller('ContentsPage', ['$scope', 'modService', function ($scope, modService) {
	$scope.requestModRootDirAccess = function () {
		modService.requestRootAccess().then(function () {
			return modService.refreshOpenDirectories();
		}).catch(function (error) {
			modService.showMessage({title: 'Could not access mod directory', text: error.message || String(error)});
		});
	}
	$scope.reattachModSource = function () {
		modService.attachSource().catch(function (error) {
			if (error && error.name == 'AbortError')
				return;
			modService.showMessage({title: 'Could not reattach mod directory', text: error.message || String(error)});
		});
	}
}]);
