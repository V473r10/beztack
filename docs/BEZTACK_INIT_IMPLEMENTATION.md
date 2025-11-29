# Implementación de Beztack Init - Sistema de Módulos Opcionales

Documento generado: **2025**

## Resumen

Se implementó un sistema completo de módulos opcionales para Beztack usando `@clack/prompts` y un CLI interactivo (`beztack-init`). Este sistema permite a los usuarios seleccionar qué módulos desean incluir en su proyecto durante la creación inicial.

## Arquitectura

### Paquete Principal: `@beztack/init`

**Ubicación**: `packages/beztack-init/`

#### Estructura de Archivos

```
packages/beztack-init/
├── package.json              # Configuración del paquete
├── tsconfig.json             # Configuración TypeScript
├── tsdown.config.ts          # Configuración del bundler
├── README.md                 # Documentación
├── dist/                     # Archivos compilados (generado)
└── src/
    ├── cli.ts                # Entry point del CLI
    ├── index.ts              # Exports públicos
    ├── modules.ts            # Definición de módulos disponibles
    ├── init-project.ts       # Lógica principal de inicialización
    ├── remove-module.ts      # Lógica para remover módulos
    ├── generate-entrypoints.ts  # Regeneración de archivos de entrada
    ├── utils/
    │   ├── workspace.ts      # Utilidades del workspace
    │   ├── remove-deps.ts    # Limpieza de dependencias
    │   └── get-nx-project-roots.ts  # Detección de proyectos Nx
    └── codemods/
        ├── shared.ts         # Funciones compartidas
        ├── remove-payments-imports.ts
        ├── remove-email-imports.ts
        ├── remove-ai-imports.ts
        ├── remove-ocr-imports.ts
        └── remove-state-imports.ts
```

## Módulos Disponibles

### Módulos Obligatorios
- **auth**: Sistema de autenticación (Better Auth) - Siempre incluido

### Módulos Opcionales
1. **payments**: Sistema de pagos con Mercado Pago
   - Package: `@beztack/payments`
   - Proyectos afectados: `api`, `ui`
   
2. **email**: Envío de emails con Resend
   - Package: `@beztack/email`
   - Proyectos afectados: `api`
   
3. **ai**: Integración con OpenAI y LLMs
   - Package: `@beztack/ai`
   - Proyectos afectados: `api`
   
4. **ocr**: Reconocimiento óptico de caracteres
   - Package: `@beztack/ocr`
   - Proyectos afectados: `api`
   
5. **state**: Manejo de estado en URL (nuqs)
   - Package: `@beztack/state`
   - Proyectos afectados: `ui`, `docs`

## Flujo de Funcionamiento

### 1. Usuario ejecuta `create-beztack`

```bash
pnpm create beztack
```

### 2. Crear proyecto base
- Clona el template completo de Beztack
- Copia todos los archivos al nuevo directorio
- Configura package.json con el nombre del proyecto

### 3. Ejecutar `beztack-init`
El sistema automáticamente ejecuta el CLI de inicialización:

```typescript
// En create-beztack/src/index.ts
runBeztackInit(projectDir);
```

### 4. Selección interactiva de módulos
Usando `@clack/prompts`, muestra un multiselect con:
- ✓ Espacio para seleccionar/deseleccionar
- ✓ Enter para confirmar
- ✓ Descripciones de cada módulo

### 5. Procesamiento de módulos

Para cada módulo NO seleccionado:

a) **Eliminar package directory**
   ```
   packages/[module-name]/ → ELIMINADO
   ```

b) **Limpiar dependencias**
   - Edita `package.json` de proyectos afectados
   - Remueve dependencias especificadas en el manifest

c) **Eliminar archivos relacionados**
   - Usa glob patterns para encontrar archivos
   - Elimina carpetas de features/modules

d) **Ejecutar codemods**
   - Usa `ts-morph` para analizar código
   - Remueve imports del paquete eliminado

### 6. Regenerar entrypoints

**API Modules Index** (`apps/api/server/modules/index.ts`):
```typescript
// AUTO-GENERATED
import { AuthModule } from "./auth/index.js";
import { PaymentsModule } from "./payments/index.js";

export const modules = [
  AuthModule,
  PaymentsModule,
];
```

**UI Routes** (`apps/ui/src/routes.tsx`):
```typescript
// AUTO-GENERATED
import { AuthRoutes } from "./features/auth/routes.js";
import { PaymentsRoutes } from "./features/payments/routes.js";

export const routes = [
  ...AuthRoutes,
  ...PaymentsRoutes,
];
```

### 7. Ejecutar `pnpm install`
Un único `pnpm install` al final para sincronizar el lockfile.

## Integración con create-beztack

### Cambios en `scripts/create-beztack/src/index.ts`

```typescript
// Nueva función agregada
function runBeztackInit(projectDir: string) {
  const spin = spinner();
  spin.start("Configuring modules");
  
  try {
    execSync("npx tsx packages/beztack-init/src/cli.ts", {
      cwd: projectDir,
      stdio: "inherit",
    });
    
    spin.stop("Modules configured");
  } catch (error) {
    spin.stop("Failed to configure modules");
    throw error;
  }
}

// Llamada integrada en el flujo
await createProjectStructure(projectDir, config);
runBeztackInit(projectDir);  // ← NUEVO
if (config.installDependencies) {
  await installDependencies(projectDir);
}
```

## Dependencias

### Nuevas dependencias en `@beztack/init`

```json
{
  "dependencies": {
    "@clack/prompts": "^0.10.1",
    "glob": "^11.0.0",
    "picocolors": "^1.1.1",
    "ts-morph": "^25.0.0"
  },
  "devDependencies": {
    "@nx/devkit": "21.4.1",
    "@types/node": "^22.15.17",
    "tsdown": "^0.11.9",
    "typescript": "^5.8.3"
  }
}
```

## Codemods

### Implementación de Codemods

Cada codemod usa `ts-morph` para analizar y modificar archivos TypeScript:

```typescript
// src/codemods/shared.ts
export async function removeImportsForPackage(packageName: string) {
  const project = new Project({
    tsConfigFilePath: join(workspaceRoot, "tsconfig.base.json"),
  });

  const files = await glob("apps/**/*.{ts,tsx}", { cwd: workspaceRoot });

  for (const relative of files) {
    const sf = project.addSourceFileAtPathIfExists(full);
    if (!sf) continue;

    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (mod === packageName || mod.startsWith(`${packageName}/`)) {
        imp.remove();
      }
    }
  }

  await project.save();
}
```

## Experiencia de Usuario

### Flujo Completo

```bash
$ pnpm create beztack

🚀 Welcome to Beztack - A Modern NX Monorepo Starter

? Project name: › my-app
? Project description: › My awesome app
? Initialize Git repository? › Yes
? Install dependencies? › Yes

✔ Project structure created

┌  Beztack Init
│
◆  Seleccioná los módulos que querés incluir:
│  ◼ Payments - Sistema de pagos con Mercado Pago
│  ◻ Email - Envío de emails con templates
│  ◼ AI - Integración con OpenAI y otros LLMs
│  ◻ OCR - Reconocimiento óptico de caracteres
│  ◼ State Management - Manejo de estado con nuqs
│
└  ⠴ Configurando módulos de Beztack...

✓ Configuración completada
✓ Dependencies installed
✓ Git repository initialized

🎉 Project created successfully!

Next steps:
  cd my-app
  cp .env.example .env
  # Configure your .env file
  pnpm run migrate
  pnpm run dev
```

## Agregar Nuevo Módulo

### 1. Definir en `modules.ts`

```typescript
{
  name: "nuevo-modulo",
  label: "Nuevo Módulo",
  description: "Descripción del módulo",
  required: false,
  packageDir: "packages/nuevo-modulo",
  npmDeps: ["@beztack/nuevo-modulo", "dependencia-externa"],
  nxProjects: ["api", "ui"],
  fileGlobs: [
    "apps/api/server/modules/nuevo-modulo/**/*",
    "apps/ui/src/features/nuevo-modulo/**/*",
  ],
  codemods: ["remove-nuevo-modulo-imports"],
}
```

### 2. Crear Codemod

```typescript
// src/codemods/remove-nuevo-modulo-imports.ts
import { removeImportsForPackage } from "./shared.js";

export async function run() {
  await removeImportsForPackage("@beztack/nuevo-modulo");
}
```

## Beneficios

### ✅ Para el Usuario
- **Proyectos más ligeros**: Solo incluye lo que necesita
- **Menos dependencias**: Reduce node_modules
- **Setup más rápido**: No hay que remover módulos manualmente
- **Experiencia guiada**: Interfaz clara y amigable

### ✅ Para el Desarrollo
- **Mantenible**: Módulos claramente definidos
- **Extensible**: Fácil agregar nuevos módulos
- **Consistente**: Proceso automatizado y confiable
- **Sin duplicación**: Lógica centralizada en un solo paquete

## Testing

### Manual Testing

1. Crear nuevo proyecto:
```bash
pnpm create beztack test-project
```

2. Seleccionar módulos en el CLI interactivo

3. Verificar que:
   - Los módulos no seleccionados fueron removidos
   - Los package.json están limpios
   - Los imports fueron removidos
   - Los entrypoints se regeneraron correctamente
   - El proyecto builds sin errores

### Verificación de Build

```bash
cd test-project
pnpm install
pnpm build
```

## Archivos Generados Automáticamente

Los siguientes archivos se regeneran automáticamente:

- `apps/api/server/modules/index.ts`
- `apps/ui/src/routes.tsx`

**⚠️ ADVERTENCIA**: No editar manualmente - incluyen comentario:
```typescript
// AUTO-GENERATED – DO NOT EDIT
```

## Consideraciones Técnicas

### 1. Gestión de Dependencias
- Edición directa de `package.json` (no usa `pnpm add/remove`)
- Un solo `pnpm install` al final
- Previene problemas de sincronización del lockfile

### 2. Detección de Proyectos Nx
- Busca en `apps/` y `packages/`
- Verifica `project.json` o `package.json`
- No requiere `@nx/devkit` en runtime

### 3. Codemods
- Usa `ts-morph` para análisis AST
- Solo remueve imports exactos o con prefijo
- Preserva el resto del código intacto

### 4. Error Handling
- Codemods fallan gracefully (warnings)
- Spinner feedback durante operaciones largas
- Mensajes de error descriptivos

## Restricciones y Limitaciones

1. **Módulos obligatorios**: No se pueden desinstalar (ej: auth)
2. **Post-install**: No se puede ejecutar después de instalar dependencias
3. **TypeScript only**: Codemods solo funcionan con .ts/.tsx
4. **Regeneración**: Los entrypoints se sobrescriben completamente

## Próximos Pasos Sugeridos

1. **Tests automatizados**: Agregar tests para cada módulo
2. **Validación**: Verificar integridad del proyecto después de init
3. **Rollback**: Permitir agregar módulos después de la creación
4. **Templates**: Soportar diferentes tipos de proyectos
5. **Analytics**: Tracking de módulos más usados

## Referencias

- Plan original: `plan/beztack_cli.md`
- Paquete: `packages/beztack-init/`
- CLI: `packages/beztack-init/src/cli.ts`
- Integración: `scripts/create-beztack/src/index.ts`

---

**Status**: ✅ Implementación completa y funcional
**Build**: ✅ Exitoso
**Dependencies**: ✅ Instaladas
**Testing**: ⏳ Pendiente de testing manual completo
