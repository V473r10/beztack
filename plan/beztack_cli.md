# 🧩 Beztack — Sistema de módulos opcionales (versión con `@clack/prompts` + `create-beztack`)

> Documento orientado a un agente de código.  
> Objetivo: implementar un sistema de módulos opcionales en Beztack usando **pnpm workspaces**, **Nx** y una CLI basada en **`@clack/prompts`**, integrada con el paquete existente **`create-beztack`**.

---

## 0. Contexto y restricciones

- Monorepo TypeScript con:
  - **pnpm workspaces**
  - **Nx** para manejo de tareas/proyectos
- Ya existe el paquete **`create-beztack`**, invocado como:
  - `pnpm create beztack`
  - o `pnpm create-beztack`
- Queremos:
  - Un sistema de **módulos opcionales** (`auth`, `storage-s3`, etc.)
  - Un comando (o binario) tipo `beztack-init` que se ejecute en el proyecto recién creado y:
    - No reciba parámetros de módulos.
    - Muestre un **listado interactivo** usando `@clack/prompts`.
    - Permita marcar/desmarcar módulos con **espacio**.
    - Confirmar con **Enter**.
- No usar `commander`.  
  Usar **`@clack/prompts`** para:
  - Mostrar mensajes.
  - Multi-select interactivo.
  - Spinners / tasks.

- No llamar `pnpm add/remove`.  
  La CLI debe:
  - Editar `package.json` directamente.
  - Ejecutar **un solo `pnpm install`** al final para sincronizar `pnpm-lock.yaml`.

- Evitar duplicar lógica entre:
  - `create-beztack`
  - `beztack-init` (o similar)

  Ideal:
  - Paquete/lógica **centralizada** (por ejemplo `@beztack/init`) con toda la lógica de módulos.
  - `create-beztack` sólo crea/clona el monorepo base y luego llama a esa lógica.

---

## 1. Estructura propuesta de paquetes

### 1.1. Paquete de lógica de inicialización: `@beztack/init` (o `beztack-init`)

Crear un paquete (dentro del monorepo o como paquete separado) que contenga:

- El manifest de módulos.
- La lógica de:
  - `initProject()`
  - `removeModule()`
  - Generación de entrypoints.
  - Codemods.
- Una CLI que se ejecuta en el **directorio raíz del proyecto recién generado**.

Nombre sugerido del binario: **`beztack-init`**.

### 1.2. Integración en `create-beztack`

El flujo de `create-beztack` queda así:

1. Crea el proyecto (clona/copia el template).
2. Cambia `cwd` al nuevo directorio (e.g. `projectDir`).
3. Ejecuta el CLI de `@beztack/init`:
   - `npx beztack-init`
   - o ejecución programática del módulo.

De este modo:

- **No hay lógica duplicada**.
- Cualquier ajuste al sistema de módulos sólo se toca en `@beztack/init`.

---

## 2. Manifest de módulos

Crear archivo en el paquete `@beztack/init`:

`packages/beztack-init/src/modules.ts`

```ts
export type AppName = 'api' | 'web' | 'worker';

export interface ModuleDefinition {
  name: string;              // 'auth', 'storage-s3', etc.
  label: string;             // Texto amigable para la UI
  description?: string;      // Texto corto para la UI
  required: boolean;
  packageDir?: string;       // 'packages/storage-s3'
  npmDeps?: string[];        // deps a quitar de package.json
  nxProjects?: string[];     // proyectos Nx afectados (por nombre)
  fileGlobs?: string[];      // archivos a borrar
  codemods?: string[];       // nombres de codemods a ejecutar
}

export const modules: ModuleDefinition[] = [
  {
    name: 'auth',
    label: 'Auth (obligatorio)',
    required: true,
    packageDir: 'packages/auth',
    npmDeps: ['@beztack/auth'],
    nxProjects: ['api', 'web'],
    fileGlobs: [
      'apps/api/src/modules/auth/**/*',
      'apps/web/src/features/auth/**/*',
    ],
  },
  {
    name: 'storage-s3',
    label: 'Storage S3',
    description: 'Integración con S3 para almacenamiento',
    required: false,
    packageDir: 'packages/storage-s3',
    npmDeps: [
      '@beztack/storage-s3',
      '@aws-sdk/client-s3',
      'aws-sdk',
    ],
    nxProjects: ['api', 'web'],
    fileGlobs: [
      'apps/api/src/modules/storage-s3/**/*',
      'apps/web/src/features/storage-s3/**/*',
    ],
    codemods: ['remove-storage-s3-imports'],
  },
];
```

---

## 3. CLI de `@beztack/init` usando `@clack/prompts`

### 3.1. Dependencias

En el paquete `@beztack/init`:

- Agregar dependencia: `@clack/prompts`.

### 3.2. Entry point CLI

Crear archivo:

`packages/beztack-init/src/cli.ts`

```ts
#!/usr/bin/env node
import {
  intro,
  outro,
  multiselect,
  isCancel,
  cancel,
  spinner,
} from '@clack/prompts';
import { modules } from './modules';
import { initProject } from './init-project';

export async function main() {
  intro('Beztack Init');

  const optionalModules = modules.filter((m) => !m.required);

  const selected = await multiselect({
    message: 'Seleccioná los módulos que querés incluir:',
    options: optionalModules.map((m) => ({
      value: m.name,
      label: m.label,
      hint: m.description,
    })),
  });

  if (isCancel(selected)) {
    cancel('Operación cancelada por el usuario.');
    process.exit(0);
  }

  const enabledModuleNames = [
    ...modules.filter((m) => m.required).map((m) => m.name),
    ...(selected as string[]),
  ];

  const s = spinner();
  s.start('Configurando módulos de Beztack...');

  try {
    await initProject(enabledModuleNames);
    s.stop('Configuración completada.');
  } catch (err) {
    s.stop('Ocurrió un error durante la configuración.');
    console.error(err);
    process.exit(1);
  }

  outro('Listo. Podés empezar a trabajar con tu proyecto Beztack.');
}

if (require.main === module) {
  // Ejecutado como CLI
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

Notas:

- `multiselect` de `@clack/prompts` soporta:
  - **espacio** para seleccionar/deseleccionar.
  - **enter** para confirmar.

---

## 4. Función `initProject(enabledModuleNames: string[])`

Archivo:

`packages/beztack-init/src/init-project.ts`

```ts
import { modules } from './modules';
import { removeModule } from './remove-module';
import { regenerateEntrypoints } from './generate-entrypoints';
import { workspaceRoot } from '@nx/devkit';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';

const exec = promisify(execCb);

export async function initProject(enabledModuleNames: string[]) {
  const allModules = modules;

  const enabledSet = new Set(enabledModuleNames);
  const disabled = allModules.filter((m) => !enabledSet.has(m.name));

  // 1. Remover módulos deshabilitados (sin ejecutar pnpm install aquí)
  for (const mod of disabled) {
    if (mod.required) continue; // seguridad extra
    await removeModule(mod.name, { skipInstall: true });
  }

  // 2. Regenerar entrypoints (routes, index de módulos, etc.)
  await regenerateEntrypoints();

  // 3. Ejecutar un único pnpm install en el workspaceRoot
  await exec('pnpm install', { cwd: workspaceRoot });
}
```

---

## 5. Función `removeModule` (adaptada)

Archivo:

`packages/beztack-init/src/remove-module.ts`

```ts
import { modules } from './modules';
import { workspaceRoot } from '@nx/devkit';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import { removeDepsFromPackageJson } from './utils/remove-deps';
import { getNxProjectsRootsForModule } from './utils/get-nx-project-roots';

interface RemoveModuleOptions {
  skipInstall?: boolean; // reservado por si se quisiera usar en otro contexto
}

export async function removeModule(
  name: string,
  _options: RemoveModuleOptions = {},
) {
  const mod = modules.find((m) => m.name === name);
  if (!mod) throw new Error(`Unknown module: ${name}`);
  if (mod.required) throw new Error(`Module ${name} is required and cannot be removed`);

  // 1. Eliminar carpeta de packages
  if (mod.packageDir) {
    await fs.rm(path.join(workspaceRoot, mod.packageDir), {
      recursive: true,
      force: true,
    });
  }

  // 2. Limpiar package.json de proyectos Nx afectados
  if (mod.nxProjects && mod.npmDeps?.length) {
    const roots = await getNxProjectsRootsForModule(mod.nxProjects);
    for (const root of roots) {
      await removeDepsFromPackageJson(root, mod.npmDeps);
    }
  }

  // 3. Eliminar archivos relacionados
  if (mod.fileGlobs?.length) {
    for (const pattern of mod.fileGlobs) {
      const files = await glob(pattern, { cwd: workspaceRoot });
      for (const file of files) {
        await fs.rm(path.join(workspaceRoot, file), {
          recursive: true,
          force: true,
        });
      }
    }
  }

  // 4. Ejecutar codemods
  if (mod.codemods?.length) {
    for (const codemod of mod.codemods) {
      const { run } = await import(`./codemods/${codemod}`);
      await run();
    }
  }

  // 5. NO ejecutar pnpm install aquí
  // initProject se encarga de correr un único pnpm install al final
}
```

---

## 6. Utilidades Nx (`removeDepsFromPackageJson`, `getNxProjectsRootsForModule`)

### 6.1. `removeDepsFromPackageJson`

Archivo:

`packages/beztack-init/src/utils/remove-deps.ts`

```ts
import { updateJson } from '@nx/devkit';
import * as path from 'path';
import { workspaceRoot } from '@nx/devkit';

export async function removeDepsFromPackageJson(
  projectRoot: string,
  deps: string[],
) {
  const packageJsonPath = path.join(workspaceRoot, projectRoot, 'package.json');

  await updateJson(null as any, packageJsonPath, (json) => {
    const sections = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ] as const;

    for (const section of sections) {
      if (!json[section]) continue;
      for (const dep of deps) {
        delete json[section][dep];
      }
    }

    return json;
  });
}
```

### 6.2. `getNxProjectsRootsForModule`

Archivo:

`packages/beztack-init/src/utils/get-nx-project-roots.ts`

```ts
import { workspaceRoot } from '@nx/devkit';
import * as path from 'path';
// El agente debe adaptar estas imports a la versión de Nx del repo
import {
  readCachedProjectGraph,
  ProjectGraphProjectNode,
} from '@nrwl/devkit'; // o '@nx/devkit' en versiones nuevas

export async function getNxProjectsRootsForModule(
  projectNames: string[],
): Promise<string[]> {
  const graph = readCachedProjectGraph();
  const roots: string[] = [];

  for (const name of projectNames) {
    const node: ProjectGraphProjectNode | undefined = graph.nodes[name];
    if (!node) continue;
    // node.data.root es la carpeta del proyecto
    roots.push(node.data.root);
  }

  return roots;
}
```

> Nota: el agente debe ajustar estas APIs a la versión específica de Nx usada en el repo (`readProjectsConfigurationFromProjectGraph`, etc., según corresponda).

---

## 7. Codemods

Ejemplo de codemod para `storage-s3`:

Archivo:

`packages/beztack-init/src/codemods/remove-storage-s3-imports.ts`

```ts
import { Project } from 'ts-morph';
import { glob } from 'glob';
import * as path from 'path';
import { workspaceRoot } from '@nx/devkit';

export async function run() {
  const project = new Project({
    tsConfigFilePath: path.join(workspaceRoot, 'tsconfig.base.json'),
  });

  const files = await glob('apps/**/*.{ts,tsx}', { cwd: workspaceRoot });

  for (const relative of files) {
    const full = path.join(workspaceRoot, relative);
    const sf = project.addSourceFileAtPathIfExists(full);
    if (!sf) continue;

    sf.getImportDeclarations().forEach((imp) => {
      const mod = imp.getModuleSpecifierValue();
      if (
        mod === '@beztack/storage-s3' ||
        mod.startsWith('@beztack/storage-s3/')
      ) {
        imp.remove();
      }
    });
  }

  await project.save();
}
```

---

## 8. Regeneración de entrypoints

Archivo:

`packages/beztack-init/src/generate-entrypoints.ts`

```ts
import { modules } from './modules';
import { workspaceRoot } from '@nx/devkit';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

function moduleIsActive(modName: string): boolean {
  const mod = modules.find((m) => m.name === modName);
  if (!mod?.packageDir) return true;
  return fsSync.existsSync(path.join(workspaceRoot, mod.packageDir));
}

export async function regenerateEntrypoints() {
  await generateApiModulesIndex();
  await generateWebRoutes();
}

function toPascal(name: string): string {
  return name.replace(/(^\w|-\w)/g, (m) => m.replace('-', '').toUpperCase());
}

async function generateApiModulesIndex() {
  const active = modules.filter((m) => moduleIsActive(m.name));

  const imports: string[] = [];
  const entries: string[] = [];

  for (const mod of active) {
    const baseName = toPascal(mod.name);
    const varName = `${baseName}Module`;
    imports.push(`import { ${varName} } from './${mod.name}';`);
    entries.push(`  ${varName},`);
  }

  const content = `// AUTO-GENERATED – DO NOT EDIT
${imports.join('\n')}

export const modules = [
${entries.join('\n')}
];
`;

  const target = path.join(workspaceRoot, 'apps/api/src/modules/index.ts');
  await fs.writeFile(target, content, 'utf8');
}

async function generateWebRoutes() {
  const active = modules.filter((m) => moduleIsActive(m.name));

  const imports: string[] = [];
  const entries: string[] = [];

  for (const mod of active) {
    const baseName = toPascal(mod.name);
    const varName = `${baseName}Routes`;
    imports.push(
      `import { ${varName} } from './features/${mod.name}';`,
    );
    entries.push(`  ...${varName},`);
  }

  const content = `// AUTO-GENERATED – DO NOT EDIT
${imports.join('\n')}

export const routes = [
${entries.join('\n')}
];
`;

  const target = path.join(workspaceRoot, 'apps/web/src/routes.tsx');
  await fs.writeFile(target, content, 'utf8');
}
```

---

## 9. Integración con `create-beztack`

En el código del paquete `create-beztack`:

1. Después de crear el proyecto:

   ```ts
   const projectDir = /* ruta del nuevo proyecto */;
   process.chdir(projectDir);
   ```

2. Ejecutar el CLI de `@beztack/init`:

   Variante 1 (subproceso):

   ```ts
   import { execSync } from 'child_process';

   execSync('npx beztack-init', {
     stdio: 'inherit',
     cwd: projectDir,
   });
   ```

   Variante 2 (programática, si se exporta `main`):

   ```ts
   import { main as beztackInitMain } from '@beztack/init';

   await beztackInitMain();
   ```

3. `create-beztack` no debe tener lógica de selección de módulos:
   - No mostrar prompts de módulos.
   - No tocar `package.json` según módulos.
   - Toda esa lógica vive en `@beztack/init`.

---

## 10. Resumen

- UX del usuario final:

  ```bash
  pnpm create beztack
  # → create-beztack crea el proyecto y luego ejecuta beztack-init
  # → beztack-init usa @clack/prompts para mostrar un multiselect:
  #    - espacio: seleccionar/deseleccionar módulos opcionales
  #    - enter: confirmar
  # → se remueven módulos no seleccionados, se regeneran entrypoints
  # → se ejecuta un único pnpm install
  ```

- Arquitectura:

  - `@beztack/init`:
    - Manifest de módulos.
    - Lógica de init y remoción.
    - Codemods.
    - Regeneración de entrypoints.
    - CLI basado en `@clack/prompts`.
  - `create-beztack`:
    - Sólo orquesta:
      - crear carpeta
      - clonar/template
      - llamar a `beztack-init`.

- Gestión de dependencias:
  - Edición directa de `package.json` con **Nx devkit**.
  - **Un solo `pnpm install`** al final para mantener todo consistente.

