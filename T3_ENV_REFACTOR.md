# Refactorización T3 Env - Paquete Centralizado

## Resumen

Se ha refactorizado la implementación de T3 Env de estar distribuida en cada aplicación a un paquete centralizado `@beztack/env` en el monorepo.

## Cambios Realizados

### 1. Nuevo Paquete: `packages/env`

Se creó un nuevo paquete compartido con la siguiente estructura:

```
packages/env/
├── src/
│   ├── api.ts          # Configuración para apps/api (Nitro)
│   ├── ui.ts           # Configuración para apps/ui (Vite)
│   ├── nextjs.ts       # Configuración para apps/landing y apps/docs
│   └── vite-env.d.ts   # Tipos para Vite
├── dist/               # Archivos compilados
├── package.json
├── tsconfig.json
└── README.md
```

### 2. Configuración del Paquete

**package.json**:
- Nombre: `@beztack/env`
- Versión: `0.0.1`
- Tipo: `module` con exports para cada módulo
- Dependencias: `@t3-oss/env-core`, `@t3-oss/env-nextjs`, `zod`

**Exports**:
```json
{
  "./api": "./dist/api.js",
  "./ui": "./dist/ui.js",
  "./nextjs": "./dist/nextjs.js"
}
```

### 3. Módulos Implementados

#### `api.ts` - Para Nitro/Node.js
Variables de servidor:
- **Database**: `DATABASE_URL`
- **Better Auth**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_NAME`
- **Polar**: 10 variables de configuración (product IDs, URLs, etc.)
- **Resend**: `RESEND_FROM_NAME`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`
- **Node**: `NODE_ENV`

#### `ui.ts` - Para Vite
Variables de cliente:
- `VITE_API_URL` (default: http://localhost:3000)
- `VITE_BASE_PATH` (default: /)

#### `nextjs.ts` - Para Next.js
Variables de servidor:
- `NODE_ENV` (development/production/test)

### 4. Aplicaciones Migradas

Todas las aplicaciones ahora importan desde el paquete centralizado:

#### apps/api/env.ts
```typescript
export { env } from "@beztack/env/api";
```

#### apps/ui/src/env.ts
```typescript
export { env } from "@beztack/env/ui";
```

#### apps/landing/env.ts
```typescript
export { env } from "@beztack/env/nextjs";
```

#### apps/docs/env.ts
```typescript
export { env } from "@beztack/env/nextjs";
```

### 5. Dependencias Actualizadas

**Agregadas en cada app**:
- `@beztack/env: workspace:*`

**Removidas de cada app**:
- `@t3-oss/env-core` (de apps/api y apps/ui)
- `@t3-oss/env-nextjs` (de apps/landing y apps/docs)

### 6. Archivos Modificados

**Nuevos archivos**:
- `packages/env/package.json`
- `packages/env/tsconfig.json`
- `packages/env/src/api.ts`
- `packages/env/src/ui.ts`
- `packages/env/src/nextjs.ts`
- `packages/env/src/vite-env.d.ts`
- `packages/env/README.md`

**Archivos modificados**:
- `apps/api/env.ts` - Simplificado a 5 líneas
- `apps/api/package.json` - Actualizado dependencias
- `apps/ui/src/env.ts` - Simplificado a 5 líneas
- `apps/ui/package.json` - Actualizado dependencias
- `apps/landing/env.ts` - Simplificado a 5 líneas
- `apps/landing/package.json` - Actualizado dependencias
- `apps/docs/env.ts` - Simplificado a 5 líneas
- `apps/docs/package.json` - Actualizado dependencias

## Ventajas de la Refactorización

### ✅ Centralización
- **Una sola fuente de verdad** para todas las configuraciones de env
- Más fácil de mantener y actualizar
- Consistencia en todo el monorepo

### ✅ Reducción de Código
- Los archivos `env.ts` de cada app pasaron de ~40-50 líneas a 5 líneas
- Eliminación de código duplicado
- Menor superficie de error

### ✅ Type Safety Mejorada
- Tipos compartidos y consistentes
- Mejor autocompletado en todo el monorepo
- Validación centralizada

### ✅ Mejor Experiencia de Desarrollo
- Agregar nuevas variables es más simple
- Un solo lugar para documentar variables
- Fácil de testear y validar

### ✅ Gestión de Dependencias
- Dependencias de T3 Env centralizadas en un solo paquete
- Actualizaciones más fáciles
- Mejor tree-shaking

## Uso

### Acceder a Variables de Entorno

```typescript
// En cualquier archivo de las apps
import { env } from "@/env";

// Type-safe y validado
const dbUrl = env.DATABASE_URL;
```

### Agregar Nuevas Variables

1. Editar el módulo correspondiente en `packages/env/src/`
2. Agregar la variable al schema Zod
3. Recompilar el paquete: `pnpm build`
4. Las apps automáticamente tendrán acceso a la nueva variable

## Verificación

### Build Exitoso
```bash
# Compilar el paquete env
cd packages/env && pnpm build
✓ Compilación exitosa

# Verificar apps
cd apps/ui && pnpm exec tsc -b --force
✓ Sin errores de TypeScript
```

### Instalación de Dependencias
```bash
pnpm install
✓ @beztack/env instalado en todas las apps
```

## Compatibilidad

- ✅ **Retrocompatible**: Todas las apps siguen usando `import { env } from "@/env"`
- ✅ **Sin cambios en código de negocio**: Solo se actualizó la fuente de env
- ✅ **Mismas validaciones**: Se mantienen todas las validaciones existentes

## Próximos Pasos

### Opcional - Mejoras Futuras

1. **Tests del Paquete**: Agregar tests unitarios para validaciones
2. **CI/CD**: Incluir verificación de env en pipeline
3. **Documentación**: Agregar ejemplos de uso en docs
4. **Validaciones Custom**: Agregar helpers de validación comunes

## Conclusión

La refactorización se completó exitosamente. El código es más mantenible, los tipos están mejor definidos, y la experiencia de desarrollo ha mejorado significativamente.

**Estado**: ✅ **COMPLETADO**

---

**Fecha de Implementación**: 21 de Noviembre, 2025
**Implementado por**: AI Assistant
