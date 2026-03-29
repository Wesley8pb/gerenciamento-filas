@echo off
echo ==========================================
echo  PRE-DEPLOY CHECKLIST - Sistema Fila Eleitoral
echo ==========================================
echo.

echo [1/5] Verificando TypeScript...
npm run typecheck
if %errorlevel% neq 0 (
    echo ERRO: TypeScript encontrou erros!
    exit /b 1
)
echo [OK] TypeScript verificado
echo.

echo [2/5] Executando ESLint...
npm run lint
if %errorlevel% neq 0 (
    echo ERRO: ESLint encontrou problemas!
    exit /b 1
)
echo [OK] ESLint verificado
echo.

echo [3/5] Executando testes...
npm run test:run
if %errorlevel% neq 0 (
    echo ERRO: Testes falharam!
    exit /b 1
)
echo [OK] Testes passaram
echo.

echo [4/5] Verificando cobertura...
npm run test:coverage
if %errorlevel% neq 0 (
    echo ERRO: Cobertura insuficiente!
    exit /b 1
)
echo [OK] Cobertura verificada
echo.

echo [5/5] Build de producao...
npm run build
if %errorlevel% neq 0 (
    echo ERRO: Build falhou!
    exit /b 1
)
echo [OK] Build completo
echo.

echo ==========================================
echo  TODAS AS VERIFICACOES PASSARAM!
echo  Pronto para deploy.
echo ==========================================
