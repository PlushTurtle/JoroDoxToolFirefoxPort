browser.action.onClicked.addListener(function () {
	browser.windows.create({
		url: browser.runtime.getURL('index.html'),
		type: 'popup'
	}).catch(function (error) {
		console.error('Unable to open JoroDox:', error);
	});
});
