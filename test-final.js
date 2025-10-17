// Teste final com a função corrigida
const testData = [
    {
        user: {
            tags: {
                'POSTO FAVORITO': 'RHAM AUTO POSTO LUZIANIA'
            }
        }
    },
    {
        user: {
            tags: {
                'POSTO FAVORITO': 'POSTO ALVORADA'
            }
        }
    },
    {
        user: {
            tags: {
                'POSTO FAVORITO': 'OUTRO POSTO'
            }
        }
    },
    {
        user: {
            tags: {
                'POSTO FAVORITO': 'RHAM AUTO POSTO LUZIANIA'
            }
        }
    }
];

// Função convertTagNotation CORRIGIDA (como está no script.js agora)
function convertTagNotation(expression) {
    // NÃO converter as chaves das tags - manter a notação original
    // A função getValueByPath já lida com notação de colchetes corretamente
    return expression;
}

// Função getValueByPath do script original
function getValueByPath(obj, path) {
    try {
        // Usar Function para acessar propriedades com notação de colchetes de forma segura
        const func = new Function('obj', `return obj.${path}`);
        return func(obj);
    } catch (e) {
        // Fallback para notação de ponto simples
        return path.split('.').reduce((acc, part) => {
            if (acc && typeof acc === 'object') {
                return acc[part];
            }
            return undefined;
        }, obj);
    }
}

// Testar a expressão
const expression = "item.user.tags['POSTO FAVORITO'] ==='RHAM AUTO POSTO LUZIANIA' || item.user.tags['POSTO FAVORITO'] === 'POSTO ALVORADA'";
const convertedExpression = convertTagNotation(expression);

console.log('=== TESTE FINAL COM CORREÇÃO ===');
console.log('Expressão original:', expression);
console.log('Expressão convertida:', convertedExpression);
console.log('');

// Testar cada item individualmente
console.log('Testando cada item:');
testData.forEach((item, index) => {
    try {
        const filterFn = new Function('item', `try { return ${convertedExpression}; } catch (e) { return false; }`);
        const result = filterFn(item);
        console.log(`Item ${index + 1} (${item.user.tags['POSTO FAVORITO']}): ${result ? '✅ MATCH' : '❌ NO MATCH'}`);
    } catch (error) {
        console.log(`Item ${index + 1}: ❌ ERRO - ${error.message}`);
    }
});

console.log('');

// Aplicar filtro completo
try {
    const filterFn = new Function('item', `try { return ${convertedExpression}; } catch (e) { return false; }`);
    const filteredData = testData.filter(filterFn);
    console.log(`🎯 Resultado: ${filteredData.length} de ${testData.length} itens passaram no filtro`);
    filteredData.forEach((item, index) => {
        console.log(`  ✅ ${index + 1}: ${item.user.tags['POSTO FAVORITO']}`);
    });
} catch (error) {
    console.log('❌ ERRO ao aplicar filtro:', error.message);
}