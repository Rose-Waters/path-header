
import * as vscode from 'vscode';
import * as path from 'path';

const TRACKING_KEY = 'pathHeader.managedHeaders';

type HeaderRecords = Record<string, string>;

function getConfig() {
    return vscode.workspace.getConfiguration('pathHeader');
}

function getFileKey(uri: vscode.Uri): string {
    return uri.toString();
}

async function getRecords(
    context: vscode.ExtensionContext
): Promise<HeaderRecords> {
    return context.workspaceState.get<HeaderRecords>(TRACKING_KEY, {});
}

async function trackHeader(
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    header: string
): Promise<void> {
    const records = await getRecords(context);
    records[getFileKey(uri)] = header;
    await context.workspaceState.update(TRACKING_KEY, records);
}

async function forgetHeader(
    context: vscode.ExtensionContext,
    uri: vscode.Uri
): Promise<void> {
    const records = await getRecords(context);
    delete records[getFileKey(uri)];
    await context.workspaceState.update(TRACKING_KEY, records);
}

function getRelativePath(uri: vscode.Uri): string {
    const style = getConfig().get<string>('pathStyle', 'relative');

    const filePath =
        style === 'absolute'
            ? uri.fsPath
            : vscode.workspace.asRelativePath(uri, false);

    return filePath.replace(/\\/g, '/');
}

function isStrictJson(uri: vscode.Uri): boolean {
    return path.extname(uri.fsPath).toLowerCase() === '.json';
}

function getLanguageRule(document: vscode.TextDocument): boolean {
    if (isStrictJson(document.uri)) {
        return false;
    }

    const rules = getConfig().get<Record<string, boolean>>(
        'languageRules',
        {}
    );

    if (
        Object.prototype.hasOwnProperty.call(
            rules,
            document.languageId
        )
    ) {
        return rules[document.languageId];
    }

    return true;
}

function getCommentStyle(uri: vscode.Uri) {
    const extension = path.extname(uri.fsPath).toLowerCase();

    if (['.html', '.xml', '.svg', '.vue'].includes(extension)) {
        return { open: '<!-- ', close: ' -->' };
    }

    if (['.py', '.sh', '.rb', '.yaml', '.yml'].includes(extension)) {
        return { open: '# ', close: '' };
    }

    if (['.css', '.scss', '.less'].includes(extension)) {
        return { open: '/* ', close: ' */' };
    }

    return { open: '// ', close: '' };
}

function createHeader(uri: vscode.Uri): string | undefined {
    if (isStrictJson(uri)) {
        return undefined;
    }

    const style = getCommentStyle(uri);
    const prefix = getConfig().get<string>('prefix', '');
    const filePath = getRelativePath(uri);

    return `${style.open}${prefix}${filePath}${style.close}`;
}

async function isTrackedHeader(
    context: vscode.ExtensionContext,
    uri: vscode.Uri,
    line: string
): Promise<boolean> {
    const records = await getRecords(context);
    return records[getFileKey(uri)] === line.trim();
}

async function insertHeader(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument
): Promise<void> {
    if (!getLanguageRule(document) || document.lineCount === 0) {
        return;
    }

    const header = createHeader(document.uri);

    if (!header) {
        return;
    }

    const firstLine = document.lineAt(0).text;

    // Never overwrite an existing first line.
    if (firstLine.trim().length > 0) {
        return;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(0, 0), `${header}\n`);

    if (await vscode.workspace.applyEdit(edit)) {
        await trackHeader(context, document.uri, header);
    }
}

async function updateExistingHeader(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument
): Promise<void> {
    if (document.lineCount === 0) {
        return;
    }

    const firstLine = document.lineAt(0).text;
    const tracked = await isTrackedHeader(
        context,
        document.uri,
        firstLine
    );

    if (!tracked) {
        return;
    }

    const newHeader = createHeader(document.uri);

    if (!newHeader || firstLine.trim() === newHeader) {
        return;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, document.lineAt(0).range, newHeader);

    if (await vscode.workspace.applyEdit(edit)) {
        await trackHeader(context, document.uri, newHeader);
    }
}

async function adoptSaveAsHeader(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument
): Promise<boolean> {
    if (document.lineCount === 0) {
        return false;
    }

    const firstLine = document.lineAt(0).text.trim();
    const records = await getRecords(context);

    // If this exact generated header belongs to another tracked file,
    // treat it as a potential Save As copy.
    const oldKey = Object.keys(records).find(
        key => key !== getFileKey(document.uri) &&
            records[key] === firstLine
    );

    if (!oldKey) {
        return false;
    }

    const newHeader = createHeader(document.uri);

    if (!newHeader) {
        return false;
    }

    await trackHeader(context, document.uri, firstLine);

    if (newHeader !== firstLine) {
        await updateExistingHeader(context, document);
    }

    return true;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Path Header is active!');

    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );

    statusBarItem.command = 'path-header.toggleAutoInsert';
    context.subscriptions.push(statusBarItem);

    function updateStatusBar() {
        const enabled = getConfig().get<boolean>('autoInsert', true);

        statusBarItem.text = enabled ? '$(file-code)' : '$(circle-slash)';

        statusBarItem.tooltip = enabled
            ? 'Path Header: Automatic insertion enabled (click to disable)'
            : 'Path Header: Automatic insertion disabled (click to enable)';

        statusBarItem.accessibilityInformation = {
            label: enabled
                ? 'Path Header: Automatic insertion enabled'
                : 'Path Header: Automatic insertion disabled',
            role: 'button'
        };

        statusBarItem.show();
    }

    updateStatusBar();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('pathHeader')) {
                updateStatusBar();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'path-header.toggleAutoInsert',
            async () => {
                const config = getConfig();
                const enabled = config.get<boolean>('autoInsert', true);

                await config.update(
                    'autoInsert',
                    !enabled,
                    vscode.ConfigurationTarget.Global
                );

                updateStatusBar();

                vscode.window.showInformationMessage(
                    `Path Header automatic insertion ${
                        !enabled ? 'enabled' : 'disabled'
                    }.`
                );
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'path-header.addFilePath',
            async () => {
                const editor = vscode.window.activeTextEditor;

                if (!editor) {
                    vscode.window.showWarningMessage(
                        'No file is currently open.'
                    );
                    return;
                }

                const document = editor.document;

                if (!getLanguageRule(document)) {
                    vscode.window.showInformationMessage(
                        `Path Header is disabled for ${document.languageId} files.`
                    );
                    return;
                }

                if (document.lineCount > 0) {
                    const firstLine = document.lineAt(0).text;

                    if (
                        await isTrackedHeader(
                            context,
                            document.uri,
                            firstLine
                        )
                    ) {
                        await updateExistingHeader(context, document);
                        return;
                    }

                    if (firstLine.trim().length > 0) {
                        vscode.window.showInformationMessage(
                            'The first line is not a tracked Path Header. No changes were made.'
                        );
                        return;
                    }
                }

                await insertHeader(context, document);
            }
        )
    );

    context.subscriptions.push(
        vscode.workspace.onDidCreateFiles(async event => {
            if (!getConfig().get<boolean>('autoInsert', true)) {
                return;
            }

            for (const uri of event.files) {
                try {
                    const document =
                        await vscode.workspace.openTextDocument(uri);

                    await insertHeader(context, document);
                } catch (error) {
                    console.error(
                        `Could not add header to ${uri.fsPath}:`,
                        error
                    );
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(async event => {
            for (const file of event.files) {
                try {
                    const records = await getRecords(context);
                    const oldKey = getFileKey(file.oldUri);
                    const newKey = getFileKey(file.newUri);
                    const oldHeader = records[oldKey];

                    if (!oldHeader) {
                        continue;
                    }

                    delete records[oldKey];
                    records[newKey] = oldHeader;
                    await context.workspaceState.update(
                        TRACKING_KEY,
                        records
                    );

                    const document =
                        await vscode.workspace.openTextDocument(file.newUri);

                    await updateExistingHeader(context, document);
                } catch (error) {
                    console.error(
                        `Could not update header for ${file.newUri.fsPath}:`,
                        error
                    );
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async document => {
            try {
                const tracked = await isTrackedHeader(
                    context,
                    document.uri,
                    document.lineCount > 0
                        ? document.lineAt(0).text
                        : ''
                );

                if (tracked) {
                    await updateExistingHeader(context, document);
                } else {
                    await adoptSaveAsHeader(context, document);
                }
            } catch (error) {
                console.error('Could not update saved file header:', error);
            }
        })
    );
}

export function deactivate() {}
