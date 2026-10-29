const localtunnel = require('localtunnel');

let currentTunnel = null;

async function createTunnel() {
  try {
    currentTunnel = await localtunnel({ port: 4000 });
    console.log('========================================================');
    console.log('PUBLIC_TUNNEL_URL: ' + currentTunnel.url);
    console.log('========================================================');

    currentTunnel.on('close', () => {
      console.log('Tunnel connection closed. Reconnecting in 3s...');
      setTimeout(createTunnel, 3000);
    });

    currentTunnel.on('error', (err) => {
      console.error('Tunnel error:', err.message);
      try { currentTunnel.close(); } catch (_) {}
      setTimeout(createTunnel, 3000);
    });
  } catch (err) {
    console.error('Failed to establish tunnel:', err.message);
    setTimeout(createTunnel, 3000);
  }
}

// Keep Node event loop alive indefinitely
setInterval(() => {}, 60000);

createTunnel();
