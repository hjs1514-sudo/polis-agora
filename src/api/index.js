// 실사용판과 체험판을 가르는 곳. 체험판 빌드(npm run build:demo)에는 서버 코드가 아예 들어가지 않는다.
import { serverApi } from './server.js';
import { demoApi, DEMO } from './demo.js';

export const IS_DEMO = import.meta.env.MODE === 'demo';
export const api = IS_DEMO ? demoApi : serverApi;
export const DEMO_INFO = IS_DEMO ? DEMO : {};
