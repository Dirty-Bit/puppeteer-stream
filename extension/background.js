// @ts-nocheck
/* global chrome, MediaRecorder, FileReader */

const recorders = {};

chrome.webRequest.onBeforeRequest.addListener(function() { 
	return { 'redirectUrl': chrome.extension.getURL('zoom.min.js') } 
}, { 
	urls: ['https://*.zoom.us/*/js_media.min.js*'], 
	types: ['script'] 
}, ['blocking']);

function START_RECORDING({
	index,
	video,
	audio,
	frameSize,
	audioBitsPerSecond,
	videoBitsPerSecond,
	bitsPerSecond,
	mimeType,
	defaultViewport
}) {

		var onTabCaputureReady = function() {
			chrome.tabCapture.capture(
				{
					audio,
					video,
				},
				(stream) => {

					console.log(stream);

					if (!stream) {
						// an error has occurred
						console.error('chrome runtime last error', chrome.runtime.lastError);
						return;
					};
	
					recorder = new MediaRecorder(stream, {
						ignoreMutedMedia: true,
						audioBitsPerSecond,
						videoBitsPerSecond,
						bitsPerSecond,
						mimeType,
					});
					recorders[index] = recorder;
					// TODO: recorder onerror
	
					recorder.ondataavailable = async function (event) {
						if (event.data.size > 0) {
							const buffer = await event.data.arrayBuffer();
							const data = arrayBufferToString(buffer);
	
							if (window.sendData) {
								window.sendData({
									id: index,
									data,
								});
							}
						}
					};
					recorder.onerror = (e) => {
						console.error('recorder.onerror', e);
						recorder.stop();
					}
	
					recorder.onstop = function () {
						try {
							const tracks = stream.getTracks();
	
							tracks.forEach(function (track) {
								track.stop();
							});
						} catch (error) {}
					};
					stream.oninactive = () => {
						try {
							recorder.stop();
						} catch (error) {}
					};
	
					recorder.start(frameSize);
				}
			);
		}

		if (defaultViewport && defaultViewport.width && defaultViewport.height) {
			// change window size to match options, puppeteer viewport is not the same
			// as the window size and the recording can spill over beyond the bounds of viewport
			chrome.windows.getCurrent(function(targetWindow) {
				chrome.windows.update(targetWindow.id, {
					width: defaultViewport.width,
					height: defaultViewport.height
				}, function() {
					// start capture
					onTabCaputureReady();
				});
			});
		} else {
			// nothing sent, start capture
			onTabCaputureReady();
		}
}

function STOP_RECORDING(index) {
	if (!recorders[index]) return;
	recorders[index].stop();
}

function arrayBufferToString(buffer) {
	// Convert an ArrayBuffer to an UTF-8 String

	var bufView = new Uint8Array(buffer);
	var length = bufView.length;
	var result = "";
	var addition = Math.pow(2, 8) - 1;

	for (var i = 0; i < length; i += addition) {
		if (i + addition > length) {
			addition = length - i;
		}
		result += String.fromCharCode.apply(null, bufView.subarray(i, i + addition));
	}
	return result;
}
