import c from 'ansi-colors';
import { getApp } from '../../src/index';
import path from 'node:path';
const PORT = 8087;
const app = await getApp(path.resolve(__dirname, '..'), {
  exposeApiDocs: true,
  openCors: true,
  corsUrl: ['http://*.com:5173'],
});

const server = app.listen(PORT, () => {
  console.log(
    `Server is running on port ${PORT} - ${c.green(`http://localhost:${PORT}/api/`)}`
  );
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      c.bgRed(
        `端口 ${PORT} 已被占用，无法启动服务器。请检查是否有其他进程正在使用该端口。`
      )
    );
    process.exit(1);
  } else {
    console.error(c.bgRed(`服务器启动失败: ${err.message}`));
    process.exit(1);
  }
});
