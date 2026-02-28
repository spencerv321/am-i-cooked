// SSE live feed — broadcasts new analyses to connected clients in real-time

const clients = new Set()
const MAX_CLIENTS = 200

export function addClient(req, res) {
  if (clients.size >= MAX_CLIENTS) {
    res.status(503).end()
    return false
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering (Railway)
  })

  // Set reconnect interval
  res.write('retry: 5000\n\n')

  clients.add(res)

  // Keepalive every 30s to prevent proxy timeout
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, 30_000)

  req.on('close', () => {
    clearInterval(keepalive)
    clients.delete(res)
  })

  return true
}

export function broadcast(entry) {
  const data = `event: analysis\ndata: ${JSON.stringify(entry)}\n\n`
  for (const client of clients) {
    try {
      client.write(data)
    } catch {
      clients.delete(client)
    }
  }
}

export function sendSeed(res, analyses) {
  const data = `event: seed\ndata: ${JSON.stringify(analyses)}\n\n`
  try {
    res.write(data)
  } catch {
    // Client disconnected before seed
  }
}

export function getClientCount() {
  return clients.size
}
