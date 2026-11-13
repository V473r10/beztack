const APP_NAME_LINE = /^((?:VITE_)?APP_NAME)=beztack$/gm;

/**
 * Point the app name entries of an env file (`APP_NAME=beztack`,
 * `VITE_APP_NAME=beztack`) at the new project name. Other lines are untouched.
 */
export function applyAppName(content: string, projectName: string): string {
  return content.replace(APP_NAME_LINE, (_line, key: string) => `${key}=${projectName}`);
}
