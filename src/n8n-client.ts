
// Use the built-in fetch implementation provided by Node.js
async function main() {
  const serverUrl = 'http://localhost:3001';

  const sseResponse = await fetch(`${serverUrl}/sse`);
  if (sseResponse.status !== 200 || !sseResponse.body) {
    throw new Error('Failed to connect to SSE endpoint');
  }

  const reader = sseResponse.body.getReader();
  const decoder = new TextDecoder();
  let sessionId: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('event: endpoint')) {
        const dataLine = lines[lines.indexOf(line) + 1];
        const data = dataLine.replace('data: ', '');
        sessionId = data.split('sessionId=')[1];
        break;
      }
    }
    if (sessionId) break;
  }

  if (!sessionId) throw new Error('Unable to obtain session id');

  await fetch(`${serverUrl}/messages?sessionId=${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'kubectl_get',
        arguments: {
          resourceType: 'pods',
          namespace: 'default',
          output: 'json'
        }
      }
    })
  });

  let result: any;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('event: message')) {
        const dataLine = lines[lines.indexOf(line) + 1];
        result = JSON.parse(dataLine.replace('data: ', ''));
        break;
      }
    }
    if (result) break;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
