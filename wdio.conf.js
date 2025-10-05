"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
var path = require("node:path");
var child_process_1 = require("child_process");
var url_1 = require("url");
// @ts-ignore
var __dirname = (0, url_1.fileURLToPath)(new URL('.', import.meta.url));
// keep track of the `tauri-driver` child process
var tauriDriver;
var exit = false;
exports.config = {
    host: '127.0.0.1',
    port: 4444,
    specs: ['./test/specs/**/*.js'],
    maxInstances: 1,
    capabilities: [
        {
            maxInstances: 1,
            'tauri:options': {
                application: 'src-tauri/target/debug/knurl',
            },
        },
    ],
    reporters: ['spec'],
    framework: 'mocha',
    baseUrl: 'http://localhost:1420',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
    },
    // ensure the rust project is built since we expect this binary to exist for the webdriver sessions
    onPrepare: function () {
        (0, child_process_1.spawnSync)('yarn', ['run', 'tauri', 'build', '--debug', '--no-bundle'], {
            stdio: 'inherit',
            shell: true,
        });
    },
    // ensure we are running `tauri-driver` before the session starts so that we can proxy the webdriver requests
    beforeSession: function () {
        tauriDriver = (0, child_process_1.spawn)(path.resolve(process.env.CARGO_HOME, 'bin', 'tauri-driver'), ['--native-driver', path.resolve(__dirname, 'msedgedriver.exe')], { stdio: [null, process.stdout, process.stderr] });
        tauriDriver.on('error', function (error) {
            console.error('tauri-driver error:', error);
            process.exit(1);
        });
        tauriDriver.on('exit', function (code) {
            if (!exit) {
                console.error('tauri-driver exited with code:', code);
                process.exit(1);
            }
        });
    },
    // clean up the `tauri-driver` process we spawned at the start of the session
    // note that afterSession might not run if the session fails to start, so we also run the cleanup on shutdown
    afterSession: function () {
        closeTauriDriver();
    },
};
function closeTauriDriver() {
    exit = true;
    tauriDriver === null || tauriDriver === void 0 ? void 0 : tauriDriver.kill();
}
function onShutdown(fn) {
    var cleanup = function () {
        try {
            fn();
        }
        finally {
            // process.exit();
        }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGHUP', cleanup);
    process.on('SIGBREAK', cleanup);
}
// ensure tauri-driver is closed when our test process exits
onShutdown(function () {
    closeTauriDriver();
});
