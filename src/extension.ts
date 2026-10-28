
import * as vscode from 'vscode';
import * as path from 'path';

function getConfig() {
    return vscode.workspace.getConfiguration('pathHeader');
}

function getRelativePath(uri: vscode.Uri): string {
    const config = getConfig();
    const pathStyle = config.get<string>('pathStyle', 'relative');

    const filePath =
        pathStyle === 'absolute'
            ? uri.fsPath
            : vscode.workspace.asRelativePath(uri, false);

    return filePath.replace(/\\/g, '/');
}

function getHeader(uri: vscode.Uri): string | undefined {
    const filePath = getRelativePath(uri);
    const extension = path.extname(uri.fsPath).toLowerCase();
    const prefix = getConfig().get<string>('prefix', '');

    // Strict JSON files cannot contain comments.
    if (extension === '.json') {
        return undefined;
    }

    if (['.html', '.xml', '.svg', '.vue'].includes(extension)) {
        return `<!-- ${prefix}${filePath} -->`;
    }

    if (
        ['.py', '.sh', '.rb', '.yaml', '.yml'].includes(extension)
    ) {
        return `# ${prefix}${filePath}`;
    }

    if (['.css', '.scss', '.less'].includes(extension)) {
        return `/* ${prefix}${filePath} */`;
    }

    return `// ${prefix}${filePath}`;
}

function getHeaderPath(line: string): string | undefined {
    const text = line.trim();
    let content: string | undefined;

    if (text.startsWith('// ')) {
        content = text.slice(3).trim();
    } else if (text.startsWith('# ')) {
        content = text.slice(2).trim();
    } else if (text.startsWith('/* ') && text.endsWith(' */')) {
        content = text.slice(3, -3).trim();
    } else if (text.startsWith('<!-- ') && text.endsWith(' -->')) {
        content = text.slice(5, -4).trim();
    }

    if (content === undefined) {
        return undefined;
    }

    const prefix = getConfig().get<string>('prefix', '');

    if (prefix && content.startsWith(prefix)) {
        content = content.slice(prefix.length);
    }

    return content;
}

function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

async function insertHeader(
    document: vscode.TextDocument
): Promise<void> {
    const header = getHeader(document.uri);

    if (!header || document.lineCount === 0) {
        return;
    }

    const existingPath = getHeaderPath(document.lineAt(0).text);

    if (existingPath !== undefined) {
        return;
    }

    const edit = new vscode.WorkspaceEdit();

    edit.insert(
        document.uri,
        new vscode.Position(0, 0),
        `${header}\n`
    );

    await vscode.workspace.applyEdit(edit);
}

async function updateExistingHeader(
    document: vscode.TextDocument
): Promise<void> {
    if (document.lineCount === 0) {
        return;
    }

    const firstLine = document.lineAt(0);
    const existingPath = getHeaderPath(firstLine.text);
    const expectedHeader = getHeader(document.uri);

    if (existingPath === undefined || !expectedHeader) {
        return;
    }

    const newPath = getRelativePath(document.uri);

    if (normalizePath(existingPath) === normalizePath(newPath)) {
        return;
    }

    const edit = new vscode.WorkspaceEdit();

    edit.replace(
        document.uri,
        firstLine.range,
        expectedHeader
    );

    await vscode.workspace.applyEdit(edit);
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Path Header is active!');

    // Manually add or update a header.
    const addHeaderCommand = vscode.commands.registerCommand(
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

            if (path.extname(document.fileName).toLowerCase() === '.json') {
                vscode.window.showWarningMessage(
                    'Strict JSON does not support comments. Use JSONC instead.'
                );
                return;
            }

            const existingPath = document.lineCount > 0
                ? getHeaderPath(document.lineAt(0).text)
                : undefined;

            if (existingPath !== undefined) {
                await updateExistingHeader(document);
            } else {
                await insertHeader(document);
            }
        }
    );

    context.subscriptions.push(addHeaderCommand);

    // Automatically add headers to newly created files if enabled.
    const createFilesListener = vscode.workspace.onDidCreateFiles(
        async event => {
            if (!getConfig().get<boolean>('autoInsert', true)) {
                return;
            }

            for (const uri of event.files) {
                try {
                    const document =
                        await vscode.workspace.openTextDocument(uri);

                    await insertHeader(document);
                } catch (error) {
                    console.error(
                        `Could not add header to ${uri.fsPath}:`,
                        error
                    );
                }
            }
        }
    );

    context.subscriptions.push(createFilesListener);

    // Update existing headers when files are renamed or moved.
    const renameFilesListener = vscode.workspace.onDidRenameFiles(
        async event => {
            for (const file of event.files) {
                try {
                    const document =
                        await vscode.workspace.openTextDocument(file.newUri);

                    if (document.lineCount === 0) {
                        continue;
                    }

                    const existingPath = getHeaderPath(
                        document.lineAt(0).text
                    );

                    if (
                        existingPath !== undefined &&
                        normalizePath(existingPath) ===
                            normalizePath(
                                getRelativePath(file.oldUri)
                            )
                    ) {
                        await updateExistingHeader(document);
                    }
                } catch (error) {
                    console.error(
                        `Could not update header for ${file.newUri.fsPath}:`,
                        error
                    );
                }
            }
        }
    );

    context.subscriptions.push(renameFilesListener);

    // Update existing headers when a file is saved under a new path.
    const saveListener = vscode.workspace.onDidSaveTextDocument(
        async document => {
            try {
                await updateExistingHeader(document);
            } catch (error) {
                console.error('Could not update saved file header:', error);
            }
        }
    );

    context.subscriptions.push(saveListener);
}

export function deactivate() {}
