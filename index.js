#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { program } from 'commander';
import isUrl from 'is-url-superb';
import parseCssUrls from 'css-url-parser';

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)));

const options = program
    .version(packageJson.version)
    .description('Checks if all images in CSS files exist')
    .option('-f, --folder <folder>', 'Folder with CSS files to check')
    .option('-v, --verbose', 'Add more output')
    .parse(process.argv)
    .opts();

// strip control characters so malicious CSS content cannot inject
// terminal escape sequences into the output
// eslint-disable-next-line no-control-regex
const sanitize = (text) => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');

const checkFolder = (opts) => {
    const folderRoot = path.resolve(opts.folder);
    let errors = 0;

    const files = fs.readdirSync(folderRoot, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name));

    for (const file of files) {
        if (path.extname(file) !== '.css') continue;

        const fileContent = fs.readFileSync(file, { encoding: 'utf-8' });
        const filePath = path.dirname(file) + path.sep;
        const cssUrls = parseCssUrls(fileContent);

        for (const cssUrl of cssUrls) {
            if (isUrl(cssUrl)) continue;

            const cssReal = cssUrl.replace(/(\?|#).*$/, '');

            const fullPath = cssReal.startsWith('/')
                ? path.resolve(folderRoot, cssReal.slice(1))
                : path.resolve(filePath, cssReal);

            // Prevent path traversal outside the folder root
            // (path.relative is case-insensitive on Windows)
            const relative = path.relative(folderRoot, fullPath);
            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                console.log(`Error found in: ${file}`);
                console.log(`Path traversal detected: ${sanitize(cssUrl)}`);
                console.log();
                errors++;
                continue;
            }

            if (!fs.existsSync(fullPath)) {
                console.log(`Error found in: ${file}`);
                console.log(`Full path not found: ${sanitize(fullPath)}`);
                console.log(`Path in CSS file: ${sanitize(cssUrl)}`);
                if (cssUrl !== cssReal) {
                    console.log(`Original path in CSS file: ${sanitize(cssReal)}`);
                }
                console.log();
                errors++;
            } else if (opts.verbose) {
                console.log(`OK: ${sanitize(fullPath)}`);
            }
        }
    }

    console.log(`Number of errors: ${errors}`);
    return errors;
};

if (!options.folder) {
    console.log('Oops! Please specify a folder');
    process.exitCode = 2;
} else if (!fs.existsSync(options.folder)) {
    console.log(`Oops! Folder does not exist: ${options.folder}`);
    process.exitCode = 3;
} else if (!fs.statSync(options.folder).isDirectory()) {
    console.log(`Oops! Folder is not a real folder: ${options.folder}`);
    process.exitCode = 4;
} else {
    const err = checkFolder(options);
    process.exitCode = err > 0 ? 1 : 0;
}
