
if ('serviceWorker' in navigator) {
window.addEventListener('load', function() {
    navigator.serviceWorker.register('pwa_sw.js').then(function(registration) {
    // Registration was successful
    console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function(err) {
    // registration failed :(
    console.log('ServiceWorker registration failed: ', err);
    });
});
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.prompt()
})

function install(deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice
        .then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
        } else {
            console.log('User dismissed the A2HS prompt');
        }
    });
}