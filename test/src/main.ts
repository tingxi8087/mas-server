import { getApp } from '../../src/index';
import path from 'node:path';
import './debug';
const PORT = 8087;
const app = await getApp(path.resolve(__dirname, '..'));

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT} - Server is running on port ${PORT}`);
});
