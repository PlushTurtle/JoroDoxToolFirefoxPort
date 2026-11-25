browser.action.onClicked.addListener(function () {
	var availableScreen = screen;
	var width = Math.floor(availableScreen.availWidth);
	var height = Math.floor(availableScreen.availHeight);
	var left = Number.isFinite(availableScreen.availLeft) ? Math.floor(availableScreen.availLeft) : 0;
	var top = Number.isFinite(availableScreen.availTop) ? Math.floor(availableScreen.availTop) : 0;

	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		console.error('Unable to open JoroDox: screen work-area dimensions are unavailable.');
		return;
	}

	browser.windows.create({
		url: browser.runtime.getURL('index.html'),
		type: 'popup',
		left: left,
		top: top,
		width: width,
		height: height
	}).catch(function (error) {
		console.error('Unable to open JoroDox:', error);
	});
});
