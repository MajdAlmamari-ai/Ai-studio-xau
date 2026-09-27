/**
 * Automated Institutional Test Suite Runner
 * Executes Unit, Integration, and Algorithmic Validation Tests
 */

process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import './smcEngine.test';
import './gateIoService.test';
import './safeguardsAndRisk.test';
import './loggerAndMetrics.test';
import './e2eCriticalFlows.test';
import '../server/engines/__tests__/SpotEngine.test';
import '../server/engines/__tests__/FuturesEngine.test';
import '../server/engines/__tests__/engineContract.test';
import '../server/session/__tests__/SessionManager.test';
import '../server/fusion/__tests__/ComparisonEngine.test';
import '../server/macro/__tests__/FredClient.test';
import '../server/macro/__tests__/COTFetcher.test';
import '../server/macro/__tests__/BasisEngine.test';
import '../server/__tests__/pythonClient.test';
import '../server/telegram/__tests__/AlertDispatcher.test';
import '../tests/e2e/flows.test';
import '../tests/load/load.test';






