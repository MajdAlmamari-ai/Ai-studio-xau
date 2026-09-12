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
