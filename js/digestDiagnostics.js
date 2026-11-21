var digestDiagnosticsModule = angular.module('digestDiagnostics', []);

digestDiagnosticsModule.config(['$provide', function ($provide) {
	$provide.decorator('$parse', ['$delegate', function ($delegate) {
		return function (expression) {
			var parsedExpression = $delegate.apply(this, arguments);
			if (typeof expression == 'string' && typeof parsedExpression == 'function')
				parsedExpression.$$digestExpression = expression;
			return parsedExpression;
		};
	}]);
}]);

digestDiagnosticsModule.factory('digestDiagnostics', ['$window', function ($window) {
	function expressionText(expression) {
		if (typeof expression == 'string')
			return expression;
		if (Array.isArray(expression))
			return '[' + expression.map(expressionText).join(', ') + ']';
		if (typeof expression == 'function' && expression.$$digestExpression)
			return expression.$$digestExpression;
		if (typeof expression == 'function')
			return 'fn: ' + (expression.name || expression.toString().replace(/\s+/g, ' ').slice(0, 240));
		return String(expression);
	}

	function scopePath(scope) {
		var path = [];
		while (scope) {
			var label = '$' + scope.$id;
			if (scope.dataNode && scope.dataNode.name)
				label += '(' + scope.dataNode.name + ')';
			else if (scope.node && scope.node.path)
				label += '(' + scope.node.path + ')';
			path.unshift(label);
			scope = scope.$parent;
		}
		return path.join('/');
	}

	return {
		install: function ($rootScope) {
			if (!/(?:^|[?&])debugDigest=1(?:&|$)/.test($window.location.search))
				return false;

			var scopePrototype = Object.getPrototypeOf($rootScope);
			var active = false;
			var registrationContext = null;
			var dirtyWatches = [];
			var maximumDirtyWatches = 20;

			function logRegistration(api, expression, scope) {
				console.info('[JoroDox digest] watch registered', {
					api: api,
					expression: expressionText(expression),
					scopePath: scopePath(scope)
				});
			}

			function snapshot(value) {
				if (value === undefined)
					return '[undefined]';
				try {
					return angular.copy(value);
				} catch (error) {
					console.warn('[JoroDox digest] Could not snapshot a dirty watch value.', error);
					return '[snapshot failed: ' + error.message + ']';
				}
			}

			function instrumentWatch(scope, watcher, expression, api) {
				var path = scopePath(scope);
				watcher.exp = expression + ' [scope: ' + path + ']';
				var originalListener = watcher.fn;
				watcher.fn = function (newValue, oldValue) {
					if (active) {
						dirtyWatches.push({
							api: api,
							expression: expression,
							scopePath: path,
							oldValue: oldValue === newValue ? '[initial]' : snapshot(oldValue),
							newValue: snapshot(newValue)
						});
						if (dirtyWatches.length > maximumDirtyWatches)
							dirtyWatches.shift();
					}
					return originalListener.apply(this, arguments);
				};
			}

			function patchWatch() {
				var originalWatch = scopePrototype.$watch;
				scopePrototype.$watch = function (watchExpression) {
					var scope = this;
					var expression = expressionText(watchExpression);
					var api = '$watch';
					if (registrationContext) {
						api = registrationContext.api + ' member';
						if (registrationContext.api == '$watchCollection')
							expression = registrationContext.expression;
					}

					if (active)
						logRegistration(api, expression, scope);

					var before = (scope.$$watchers || []).slice();
					var deregister = originalWatch.apply(scope, arguments);
					(scope.$$watchers || []).forEach(function (watcher) {
						if (before.indexOf(watcher) == -1)
							instrumentWatch(scope, watcher, expression, api);
					});
					return deregister;
				};
			}

			function patchCollectionWatch() {
				var originalWatchCollection = scopePrototype.$watchCollection;
				scopePrototype.$watchCollection = function (watchExpression) {
					var previousContext = registrationContext;
					var expression = expressionText(watchExpression);
					if (active)
						logRegistration('$watchCollection', expression, this);
					registrationContext = {api: '$watchCollection', expression: expression};
					try {
						return originalWatchCollection.apply(this, arguments);
					} finally {
						registrationContext = previousContext;
					}
				};
			}

			function patchGroupWatch() {
				var originalWatchGroup = scopePrototype.$watchGroup;
				scopePrototype.$watchGroup = function (watchExpressions) {
					var previousContext = registrationContext;
					var expressions = watchExpressions.map(expressionText);
					if (active)
						logRegistration('$watchGroup', expressions, this);
					registrationContext = {api: '$watchGroup'};
					try {
						return originalWatchGroup.apply(this, arguments);
					} finally {
						registrationContext = previousContext;
					}
				};
			}

			function patchDigest() {
				var originalDigest = scopePrototype.$digest;
				scopePrototype.$digest = function () {
					try {
						return originalDigest.apply(this, arguments);
					} catch (error) {
						if (active && error && /infdig/.test(error.message)) {
							console.error('[JoroDox digest] $rootScope:infdig; last dirty watches:', dirtyWatches.slice());
						}
						throw error;
					}
				};
			}

			patchWatch();
			patchCollectionWatch();
			patchGroupWatch();
			patchDigest();

			$rootScope.$on('$stateChangeStart', function (event, toState) {
				active = !!toState && toState.name == 'inspect.file';
				dirtyWatches = [];
				if (active)
					console.info('[JoroDox digest] Diagnostics active for file view.');
			});

			console.info('[JoroDox digest] Enabled; watch logging starts on the inspect.file route.');
			return true;
		}
	};
}]);
