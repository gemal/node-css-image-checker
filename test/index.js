#!/usr/bin/env node

'use strict';

import { strict as assert } from 'assert';
import path from 'path';
import { spawn } from 'child_process';
import { expect } from 'chai';

describe('index.js', function () {
    this.timeout(8000);

    function runTest(args, expectedCode, expectedOutputPatterns, done) {
        let out = '';
        const proc = spawn('node', [path.join(process.cwd(), 'index.js'), ...args], {
            cwd: path.join(process.cwd())
        });

        proc.stdout.on('data', (data) => {
            out += data.toString();
        });

        proc.stderr.on('data', (data) => {
            console.error('stderr:', data.toString());
        });

        proc.on('exit', (code) => {
            assert.strictEqual(code, expectedCode);
            expectedOutputPatterns.forEach(pattern => expect(out).to.match(pattern));
            done();
        });

        proc.on('error', (error) => {
            console.error('Spawn error:', error);
            done(error); // End the test with an error if the process fails
        });
    }

    it('should exit 1 having css problems', function (done) {
        runTest(['--folder', 'test/css1'], 1, [
            /Error found in:.*?style\.css/,
            /Full path not found.*?\.\.\/img\/404\.png/,
            /Path in CSS file: \.\.\/img\/404\.png\?v=5/,
            /Original path in CSS file: \.\.\/img\/404\.png/
        ], done);
    });

    it('should exit 0 having no css problems with url params ?', function (done) {
        runTest(['--folder', 'test/css2'], 0, [/Number of errors: 0/], done);
    });

    it('should exit 0 having no css problems with verbose', function (done) {
        runTest(['--verbose', '--folder', 'test/css2'], 0, [
            /OK: .*?\.\.\/firefox\.png/,
            /Number of errors: 0/
        ], done);
    });

    it('should exit 0 having no css problems without url params', function (done) {
        runTest(['--folder', 'test/css3'], 0, [/Number of errors: 0/], done);
    });

    it('should exit 0 having css problems with url params #', function (done) {
        runTest(['--folder', 'test/css4'], 0, [/Number of errors: 0/], done);
    });

    it('should exit 0 having no css problems absolute and url params', function (done) {
        runTest(['--folder', 'test/css5'], 0, [/Number of errors: 0/], done);
    });

    it('should exit 1 having css problems absolute', function (done) {
        runTest(['--folder', 'test/css6'], 1, [
            /Error found in:.*?style\.css/,
            /Full path not found: test\/css6\/404\/firefox\.png/,
            /Path in CSS file: \/404\/firefox\.png\?#iefix/,
            /Original path in CSS file: \/404\/firefox\.png/,
            /Full path not found: test\/css6\/40\/firefox\.png/,
            /Path in CSS file: \/40\/firefox\.png/,
            /Number of errors: 2/
        ], done);
    });

    it('should exit 0 having css problems url', function (done) {
        runTest(['--folder', 'test/css7'], 0, [/Number of errors: 0/], done);
    });

    it('should exit 2 if no folder is specified', function (done) {
        runTest([], 2, [/Oops! Please specify a folder\n/], done);
    });

    it('should exit 3 if folder does not exist', function (done) {
        runTest(['--folder', '404'], 3, [/Oops! Folder does not exist: 404\n/], done);
    });

    it('should exit 4 if folder is not a folder', function (done) {
        runTest(['--folder', 'test/index.js'], 4, [/Oops! Folder is not a real folder: test\/index\.js\n/], done);
    });
});
