
        document.addEventListener('DOMContentLoaded', () => {
            // --- Estado Geral ---
            let fullData = [];
            let filteredData = [];
            let headers = [];
            let suggestionHeaders = [];
            let allTagKeys = new Set();
            let allTagValues = new Map(); // Store all unique values for each tag key
            let widgetCounter = 0;
            let smartInputsInitialized = false;
            let statistics = {};
            let checklistData = [];
            let checklistChecked = new Set();

            // --- Referências aos Elementos do DOM ---
            const fileInput = document.getElementById('fileInput');
            const applyFilterBtn = document.getElementById('apply-filter');
            const clearFilterBtn = document.getElementById('clear-filter');
            const filterExpressionInput = document.getElementById('filter-expression');

            const tabViewer = document.getElementById('tab-viewer');
            const tabBi = document.getElementById('tab-bi');
            const contentViewer = document.getElementById('content-viewer');
            const contentBi = document.getElementById('content-bi');
            
            const dataContainer = document.getElementById('data-container');
            const infoArea = document.getElementById('info-area');
            const resultsCountEl = document.getElementById('results-count');
            const loader = document.getElementById('loader');

            const addWidgetForm = document.getElementById('add-widget-form');
            const widgetTypeSelect = document.getElementById('widget-type');
            const groupByContainer = document.getElementById('group-by-container');
            const dashboardGrid = document.getElementById('dashboard-grid');
            const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
            const fullscreenIcon = document.getElementById('fullscreen-icon');
            const fullscreenText = document.getElementById('fullscreen-text');

            // --- Inicialização e Event Listeners ---
            fileInput.addEventListener('change', handleFileSelect);
            applyFilterBtn.addEventListener('click', applyTableFilter);
            clearFilterBtn.addEventListener('click', clearTableFilter);

            tabViewer.addEventListener('click', (e) => { e.preventDefault(); switchTab('viewer'); });
            tabBi.addEventListener('click', (e) => { e.preventDefault(); switchTab('bi'); });
            
            widgetTypeSelect.addEventListener('change', () => {
                groupByContainer.classList.toggle('hidden', widgetTypeSelect.value === 'number');
            });
            addWidgetForm.addEventListener('submit', handleAddWidget);
            
            // Event listener para tela cheia
            toggleFullscreenBtn.addEventListener('click', toggleFullscreen);
            
            // Event listeners para checklist
            document.getElementById('create-checklist').addEventListener('click', createChecklist);
            document.getElementById('clear-all-widgets').addEventListener('click', clearAllWidgets);
            
            document.getElementById('create-predefined-widgets').addEventListener('click', () => {
                if (Object.keys(statistics).length === 0) {
                    alert("Por favor, carregue um arquivo JSON primeiro.");
                    return;
                }
                createPredefinedWidgets();
            });
            
            // Event listeners serão adicionados na inicialização

            // Event listeners para o modal de edição
            document.getElementById('edit-widget-type').addEventListener('change', () => {
                const groupByContainer = document.getElementById('edit-group-by-container');
                groupByContainer.classList.toggle('hidden', document.getElementById('edit-widget-type').value === 'number');
            });
            
            document.getElementById('edit-widget-form').addEventListener('submit', handleEditWidget);

            // --- Lógica das Abas ---
            function switchTab(tabName) {
                // Remover classe active de todas as abas
                document.querySelectorAll('.tab-link').forEach(tab => {
                    tab.classList.remove('active', 'text-blue-600', 'border-blue-500');
                    tab.classList.add('text-slate-500');
                });
                
                // Esconder todo conteúdo
                document.querySelectorAll('[id^="content-"]').forEach(content => {
                    content.classList.add('hidden');
                });
                
                // Ativar aba selecionada
                const activeTab = document.getElementById(`tab-${tabName}`);
                const activeContent = document.getElementById(`content-${tabName}`);
                
                if (activeTab && activeContent) {
                    activeTab.classList.add('active', 'text-blue-600', 'border-blue-500');
                    activeTab.classList.remove('text-slate-500');
                    activeContent.classList.remove('hidden');
                }
                
                // Se for a aba do checklist, atualizar estatísticas
                if (tabName === 'checklist' && checklistData.length > 0) {
                    updateChecklistStats();
                }
            }
            
            // --- Lógica do Input Inteligente (Sugestões e Validação) ---
            function extractAllTagKeys() {
                allTagKeys.clear();
                allTagValues.clear();
                
                // Extrair tags de todos os registros
                fullData.forEach(item => {
                    if (item.user && item.user.tags && typeof item.user.tags === 'object') {
                        Object.keys(item.user.tags).forEach(tagKey => {
                            allTagKeys.add(tagKey);
                            
                            // Extrair valores únicos para cada chave de tag
                            if (!allTagValues.has(tagKey)) {
                                allTagValues.set(tagKey, new Set());
                            }
                            
                            const tagValue = item.user.tags[tagKey];
                            if (tagValue && tagValue.toString().trim() !== '') {
                                allTagValues.get(tagKey).add(tagValue.toString());
                            }
                        });
                    }
                });
                
                // Se não encontrou tags, tentar extrair de alguns registros específicos
                if (allTagKeys.size === 0) {
                    // Procurar por registros com tags não vazias
                    for (let i = 0; i < Math.min(100, fullData.length); i++) {
                        const item = fullData[i];
                        if (item.user && item.user.tags && typeof item.user.tags === 'object') {
                            const tagKeys = Object.keys(item.user.tags);
                            if (tagKeys.length > 0) {
                                tagKeys.forEach(tagKey => {
                                    allTagKeys.add(tagKey);
                                    
                                    if (!allTagValues.has(tagKey)) {
                                        allTagValues.set(tagKey, new Set());
                                    }
                                    
                                    const tagValue = item.user.tags[tagKey];
                                    if (tagValue && tagValue.toString().trim() !== '') {
                                        allTagValues.get(tagKey).add(tagValue.toString());
                                    }
                                });
                            }
                        }
                    }
                }
            }

            function initializeSmartInputs() {
                if (smartInputsInitialized) return;
                
                // Headers básicos
                suggestionHeaders = headers.map(h => `item.${h}`);
                
                // Adicionar TODAS as tags encontradas no arquivo
                const allTags = Array.from(allTagKeys).map(tagKey => {
                    // Se a tag tem espaços, usar notação de colchetes
                    if (tagKey.includes(' ')) {
                        return `item.user.tags['${tagKey}']`;
                    }
                    return `item.user.tags.${tagKey}`;
                });
                suggestionHeaders = [...suggestionHeaders, ...allTags];
                
                setupSmartInput('filter-expression');
                setupSmartInput('widget-filter');
                setupSmartInput('widget-group-by');
                setupSmartInput('edit-widget-filter');
                setupSmartInput('edit-widget-group-by');
                smartInputsInitialized = true;
            }

            function setupSmartInput(baseId) {
                const editor = document.getElementById(baseId);
                const highlights = document.getElementById(`${baseId}-highlights`);
                const suggestionsContainer = document.getElementById(`${baseId}-suggestions`);
                let suggestionIndex = -1;
                

                // Adicionar placeholder se não existir
                if (!editor.getAttribute('data-placeholder-set')) {
                    editor.setAttribute('data-placeholder-set', 'true');
                    editor.addEventListener('focus', () => {
                        if (editor.textContent.trim() === '') {
                            editor.textContent = editor.getAttribute('data-placeholder') || '';
                            editor.style.color = '#9ca3af';
                        }
                    });
                    editor.addEventListener('blur', () => {
                        if (editor.textContent.trim() === editor.getAttribute('data-placeholder') || editor.textContent.trim() === '') {
                            editor.textContent = '';
                            editor.style.color = 'black';
                        }
                    });
                }

                const updateHighlights = () => {
                    const text = editor.textContent;
                    if (text.trim() === '' || text === editor.getAttribute('data-placeholder')) {
                        highlights.innerHTML = '';
                        return;
                    }
                    
                    const highlightedText = text.replace(/(item\.[a-zA-Z0-9_.]+)/g, (match) => {
                        if (suggestionHeaders.includes(match)) {
                            return `<span class="valid-keyword">${match}</span>`;
                        }
                        return `<span class="invalid-keyword">${match}</span>`;
                    }).replace(/\n/g, '<br>');
                    highlights.innerHTML = highlightedText;
                };

                const showSuggestions = () => {
                    const text = editor.textContent;
                    if (text.trim() === '' || text === editor.getAttribute('data-placeholder')) {
                        suggestionsContainer.classList.add('hidden');
                        return;
                    }
                    
                    // Detectar se está digitando === ou !== após uma tag (no final ou após ||/&&)
                    const tagValueMatch = text.match(/item\.user\.tags\[['"]([^'"]+)['"]\]\s*(===|!==)\s*(?:\|\||&&|$)/);
                    if (tagValueMatch) {
                        const tagKey = tagValueMatch[1];
                        const operator = tagValueMatch[2];
                        
                        console.log('Detectou tag com notação de colchetes:', tagKey, 'operator:', operator);
                        
                        // Mostrar valores únicos para esta tag
                        if (allTagValues.has(tagKey)) {
                            const values = Array.from(allTagValues.get(tagKey)).sort();
                            console.log('Valores encontrados para', tagKey, ':', values);
                            if (values.length > 0) {
                                suggestionsContainer.innerHTML = `
                                    <div class="p-2 text-xs text-slate-500 border-b border-slate-200 mb-2">💡 Valores disponíveis para "${tagKey}"</div>
                                    ${values.map(value => `<div class="suggestion-item" data-value="'${value}'">'${value}'</div>`).join('')}
                                `;
                                suggestionsContainer.classList.remove('hidden');
                                suggestionIndex = -1;
                                
                                // Adicionar event listeners
                                suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                                    item.addEventListener('click', (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selectSuggestion(item.getAttribute('data-value'));
                                    });
                                });
                                return;
                            }
                        }
                    }
                    
                    // Detectar se está digitando === ou !== após uma tag com notação de ponto (no final ou após ||/&&)
                    const tagValueMatchDot = text.match(/item\.user\.tags\.([a-zA-Z0-9_]+)\s*(===|!==)\s*(?:\|\||&&|$)/);
                    if (tagValueMatchDot) {
                        const tagKey = tagValueMatchDot[1];
                        const operator = tagValueMatchDot[2];
                        
                        console.log('Detectou tag com notação de ponto:', tagKey, 'operator:', operator);
                        
                        // Procurar pela chave original (pode ter sido convertida)
                        let originalKey = tagKey;
                        for (const key of allTagKeys) {
                            if (key.replace(/[^a-zA-Z0-9_]/g, '_') === tagKey) {
                                originalKey = key;
                                break;
                            }
                        }
                        
                        console.log('Chave original encontrada:', originalKey);
                        
                        // Mostrar valores únicos para esta tag
                        if (allTagValues.has(originalKey)) {
                            const values = Array.from(allTagValues.get(originalKey)).sort();
                            console.log('Valores encontrados para', originalKey, ':', values);
                            if (values.length > 0) {
                                suggestionsContainer.innerHTML = `
                                    <div class="p-2 text-xs text-slate-500 border-b border-slate-200 mb-2">💡 Valores disponíveis para "${originalKey}"</div>
                                    ${values.map(value => `<div class="suggestion-item" data-value="'${value}'">'${value}'</div>`).join('')}
                                `;
                                suggestionsContainer.classList.remove('hidden');
                                suggestionIndex = -1;
                                
                                // Adicionar event listeners
                                suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                                    item.addEventListener('click', (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selectSuggestion(item.getAttribute('data-value'));
                                    });
                                });
                                return;
                            }
                        }
                    }
                    
                    // Sugestões normais para campos
                    const currentWordMatch = text.match(/item\.[a-zA-Z0-9_.]*$/);
                    if (currentWordMatch) {
                        const currentWord = currentWordMatch[0];
                        const filteredSuggestions = suggestionHeaders.filter(h => h.startsWith(currentWord));
                        if (filteredSuggestions.length > 0) {
                            suggestionsContainer.innerHTML = filteredSuggestions.map(s => `<div class="suggestion-item" data-value="${s}">${s}</div>`).join('');
                            suggestionsContainer.classList.remove('hidden');
                            suggestionIndex = -1;
                            
                    // Adicionar event listeners para os novos elementos
                    suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Clicou na sugestão filtrada:', item.getAttribute('data-value')); // Debug
                            selectSuggestion(item.getAttribute('data-value'));
                        });
                    });
                        } else {
                            suggestionsContainer.classList.add('hidden');
                        }
                    } else {
                        suggestionsContainer.classList.add('hidden');
                    }
                };

                const showAllSuggestions = () => {
                    if (suggestionHeaders.length === 0) {
                        console.log('Nenhuma sugestão disponível'); // Debug
                        return;
                    }
                    
                    
                    // Agrupar sugestões por categoria
                    const groupedSuggestions = {
                        'user': suggestionHeaders.filter(h => h.startsWith('item.user.') && !h.includes('tags.')),
                        'tags': suggestionHeaders.filter(h => h.includes('tags.')),
                        'status': suggestionHeaders.filter(h => h.includes('status') || h.includes('isValid') || h.includes('isTagged')),
                        'data': suggestionHeaders.filter(h => h.includes('data') || h.includes('criadoem') || h.includes('atualizadoem')),
                        'outros': suggestionHeaders.filter(h => !h.startsWith('item.user.') && !h.includes('status') && !h.includes('isValid') && !h.includes('isTagged') && !h.includes('data'))
                    };
                    

                    let html = '<div class="p-2 text-xs text-slate-500 border-b border-slate-200 mb-2">💡 Clique em qualquer item para selecionar</div>';
                    
                    // Mostrar campos do usuário
                    if (groupedSuggestions.user.length > 0) {
                        html += '<div class="p-1 text-xs font-semibold text-slate-600 bg-slate-50">👤 Campos do Usuário</div>';
                        html += groupedSuggestions.user.map(s => `<div class="suggestion-item" data-value="${s}">${s}</div>`).join('');
                    }
                    
                    // Mostrar TAGS (nova seção)
                    if (groupedSuggestions.tags.length > 0) {
                        html += '<div class="p-1 text-xs font-semibold text-slate-600 bg-blue-50">🏷️ Tags (TODAS encontradas no arquivo)</div>';
                        html += groupedSuggestions.tags.map(s => `<div class="suggestion-item" data-value="${s}">${s}</div>`).join('');
                    } else {
                        html += '<div class="p-1 text-xs font-semibold text-slate-600 bg-red-50">🏷️ Nenhuma tag encontrada</div>';
                    }
                    
                    // Mostrar campos de status
                    if (groupedSuggestions.status.length > 0) {
                        html += '<div class="p-1 text-xs font-semibold text-slate-600 bg-slate-50">✅ Status e Validações</div>';
                        html += groupedSuggestions.status.map(s => `<div class="suggestion-item" data-value="${s}">${s}</div>`).join('');
                    }
                    
                    // Mostrar campos de data
                    if (groupedSuggestions.data.length > 0) {
                        html += '<div class="p-1 text-xs font-semibold text-slate-600 bg-slate-50">📅 Datas</div>';
                        html += groupedSuggestions.data.map(s => `<div class="suggestion-item" data-value="${s}">${s}</div>`).join('');
                    }
                    
                    // Mostrar outros campos
                    if (groupedSuggestions.outros.length > 0) {
                        html += '<div class="p-1 text-xs font-semibold text-slate-600 bg-slate-50">🔧 Outros</div>';
                        html += groupedSuggestions.outros.map(s => `<div class="suggestion-item" data-value="${s}">${s}</div>`).join('');
                    }

                    suggestionsContainer.innerHTML = html;
                    suggestionsContainer.classList.remove('hidden');
                    suggestionIndex = -1;
                    
                    
                    // Adicionar event listeners para os novos elementos
                    suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Clicou na sugestão:', item.getAttribute('data-value')); // Debug
                            selectSuggestion(item.getAttribute('data-value'));
                        });
                    });
                };
                
                editor.addEventListener('input', (e) => {
                    editor.style.color = 'black';
                    updateHighlights();
                    showSuggestions();
                });

                editor.addEventListener('blur', (e) => {
                    // Verificar se o clique foi em uma sugestão
                    if (e.relatedTarget && e.relatedTarget.classList.contains('suggestion-item')) {
                        return; // Não fechar se clicou em uma sugestão
                    }
                    
                    setTimeout(() => {
                        suggestionsContainer.classList.add('hidden');
                        if (editor.textContent.trim() === '') {
                            editor.textContent = editor.getAttribute('data-placeholder') || '';
                            editor.style.color = '#9ca3af';
                        }
                    }, 200);
                });

                editor.addEventListener('focus', () => {
                    if (editor.textContent === editor.getAttribute('data-placeholder')) {
                        editor.textContent = '';
                        editor.style.color = 'black';
                    }
                });

                editor.addEventListener('keydown', (e) => {
                    // Ctrl+Space para mostrar todas as sugestões
                    if (e.ctrlKey && e.code === 'Space') {
                        e.preventDefault();
                        showAllSuggestions();
                        return;
                    }

                    if (suggestionsContainer.classList.contains('hidden')) return;
                    const items = suggestionsContainer.querySelectorAll('.suggestion-item');
                    if (items.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        suggestionIndex = (suggestionIndex + 1) % items.length;
                        updateSuggestionHighlight(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        suggestionIndex = (suggestionIndex - 1 + items.length) % items.length;
                        updateSuggestionHighlight(items);
                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                        if (suggestionIndex > -1) {
                            e.preventDefault();
                            selectSuggestion(items[suggestionIndex].textContent);
                        }
                    }
                });

                const selectSuggestion = (suggestion) => {
                    const text = editor.textContent;
                    let newText;
                    
                    // Se estiver digitando item.xxx, substituir apenas a parte item.xxx
                    const currentWordMatch = text.match(/item\.[a-zA-Z0-9_.\[\]'"]*$/);
                    if (currentWordMatch) {
                        newText = text.replace(/item\.[a-zA-Z0-9_.\[\]'"]*$/, suggestion);
                    } else {
                        // Verificar se estamos no final de uma expressão com === ou !==
                        const tagValueMatch = text.match(/item\.user\.tags\[['"]([^'"]+)['"]\]\s*(===|!==)\s*$/);
                        const tagValueMatchDot = text.match(/item\.user\.tags\.([a-zA-Z0-9_]+)\s*(===|!==)\s*$/);
                        
                        if (tagValueMatch || tagValueMatchDot) {
                            // Substituir apenas o === ou !== no final
                            newText = text.replace(/\s*(===|!==)\s*$/, ' ' + suggestion);
                        } else {
                            // Se não estiver digitando item.xxx, adicionar no final
                            newText = text + suggestion;
                        }
                    }
                    
                    editor.textContent = newText;
                    editor.style.color = 'black';
                    updateHighlights();
                    suggestionsContainer.classList.add('hidden');
                    
                    // Move cursor to end
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                };

                const updateSuggestionHighlight = (items) => {
                    items.forEach((item, index) => {
                        item.classList.toggle('active', index === suggestionIndex);
                    });
                };
                
                suggestionsContainer.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.target.classList.contains('suggestion-item')) {
                        selectSuggestion(e.target.textContent);
                    }
                });

                // Inicializar highlights
                updateHighlights();
                
                // Event listener global para sugestões (fallback)
                document.addEventListener('click', (e) => {
                    if (e.target.classList.contains('suggestion-item')) {
                        e.preventDefault();
                        e.stopPropagation();
                        const suggestion = e.target.getAttribute('data-value') || e.target.textContent;
                        console.log('Clicou na sugestão global:', suggestion); // Debug
                        selectSuggestion(suggestion);
                    }
                });
            }

            // --- Funções do Checklist ---
            function createChecklist() {
                if (filteredData.length === 0) {
                    alert("Nenhum dado filtrado para criar checklist. Aplique um filtro primeiro ou carregue dados.");
                    return;
                }
                
                // Salvar dados do checklist
                checklistData = [...filteredData];
                saveChecklistToStorage();
                
                // Mostrar checklist na aba atual
                showChecklistInCurrentTab();
                
                alert(`Checklist criado com ${checklistData.length} itens!`);
            }
            
            function showChecklistInCurrentTab() {
                const dataContainer = document.getElementById('data-container');
                dataContainer.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-md mb-8">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-slate-800">📋 Checklist Planilha</h2>
                            <div class="flex gap-2">
                                <button id="clear-checklist" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm">
                                    🗑️ Limpar Checklist
                                </button>
                                <button id="export-checklist" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm">
                                    📤 Exportar Selecionados
                                </button>
                                <button id="back-to-table" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                                    ← Voltar para Tabela
                                </button>
                            </div>
                        </div>
                        <div class="mb-4">
                            <p class="text-sm text-slate-600">
                                <span id="checklist-total">Total: ${checklistData.length}</span> | 
                                <span id="checklist-checked">Marcados: 0</span> | 
                                <span id="checklist-remaining">Restantes: ${checklistData.length}</span>
                            </p>
                        </div>
                        <div id="checklist-container" class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-slate-200">
                                <thead class="bg-slate-50">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">
                                            <input type="checkbox" id="select-all-checklist" class="rounded border-slate-300">
                                        </th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nome / Telefone</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tags</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Validação</th>
                                    </tr>
                                </thead>
                                <tbody id="checklist-tbody" class="bg-white divide-y divide-slate-200">
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                
                // Event listeners
                document.getElementById('clear-checklist').addEventListener('click', clearChecklist);
                document.getElementById('export-checklist').addEventListener('click', exportChecklist);
                document.getElementById('back-to-table').addEventListener('click', backToTable);
                document.getElementById('select-all-checklist').addEventListener('change', toggleSelectAllChecklist);
                
                // Renderizar dados
                renderChecklistData();
            }
            
            function backToTable() {
                renderTable(filteredData);
            }
            
            // Função removida - agora usa showChecklistInCurrentTab
            
            function renderChecklistData() {
                const tbody = document.getElementById('checklist-tbody');
                if (!tbody) return;
                
                tbody.innerHTML = '';
                
                checklistData.forEach((item, index) => {
                    const isChecked = checklistChecked.has(index);
                    const tags = item.user?.tags || {};
                    
                    const row = document.createElement('tr');
                    row.className = isChecked ? 'bg-green-50' : 'hover:bg-slate-50';
                    
                    // Criar células individualmente
                    const checkboxCell = document.createElement('td');
                    checkboxCell.className = 'px-3 py-2 whitespace-nowrap';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'item-checkbox rounded border-slate-300';
                    checkbox.dataset.index = index;
                    if (isChecked) checkbox.checked = true;
                    checkboxCell.appendChild(checkbox);
                    
                    const idCell = document.createElement('td');
                    idCell.className = 'px-3 py-2 whitespace-nowrap text-sm text-slate-900';
                    // Usar a mesma lógica da tabela principal
                    const idValue = item.id || item.user?.id || (index + 1);
                    idCell.textContent = idValue;
                    
                    const nameCell = document.createElement('td');
                    nameCell.className = 'px-3 py-2 whitespace-nowrap text-sm text-slate-900';
                    // Usar a mesma lógica da tabela principal - nome completo e telefone
                    const nomeCompleto = getValueByPath(item, 'user.nome_completo') || 'N/A';
                    const telefone = getValueByPath(item, 'user.telefone_celular') || 'N/A';
                    nameCell.innerHTML = `
                        <div class="font-medium text-slate-900">${nomeCompleto}</div>
                        <div class="text-slate-500 text-xs">${telefone}</div>
                    `;
                    
                    const statusCell = document.createElement('td');
                    statusCell.className = 'px-3 py-2 whitespace-nowrap text-sm';
                    const statusSpan = document.createElement('span');
                    statusSpan.className = `px-2 py-1 text-xs font-medium rounded-full ${item.user?.status === 'APROVADO' ? 'bg-green-100 text-green-800' : item.user?.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`;
                    statusSpan.textContent = item.user?.status || 'N/A';
                    statusCell.appendChild(statusSpan);
                    
                    const tagsCell = document.createElement('td');
                    tagsCell.className = 'px-3 py-2 text-sm text-slate-900';
                    if (Object.keys(tags).length > 0) {
                        tagsCell.innerHTML = createTagMiniSheet(tags);
                    } else {
                        const noTagsDiv = document.createElement('div');
                        noTagsDiv.className = 'text-xs text-slate-400 italic';
                        noTagsDiv.textContent = 'Sem tags';
                        tagsCell.appendChild(noTagsDiv);
                    }
                    
                    const validCell = document.createElement('td');
                    validCell.className = 'px-3 py-2 whitespace-nowrap text-sm';
                    const validSpan = document.createElement('span');
                    validSpan.className = `px-2 py-1 text-xs font-medium rounded-full ${item.isValidUser ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
                    validSpan.textContent = item.isValidUser ? 'Válido' : 'Inválido';
                    validCell.appendChild(validSpan);
                    
                    // Adicionar células à linha
                    row.appendChild(checkboxCell);
                    row.appendChild(idCell);
                    row.appendChild(nameCell);
                    row.appendChild(statusCell);
                    row.appendChild(tagsCell);
                    row.appendChild(validCell);
                    
                    tbody.appendChild(row);
                });
                
                // Event listeners para checkboxes
                tbody.querySelectorAll('.item-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', handleChecklistItemChange);
                });
                
                updateChecklistStats();
            }
            
            function handleChecklistItemChange(event) {
                const index = parseInt(event.target.dataset.index);
                const isChecked = event.target.checked;
                
                if (isChecked) {
                    checklistChecked.add(index);
                } else {
                    checklistChecked.delete(index);
                }
                
                // Atualizar cor da linha
                const row = event.target.closest('tr');
                if (isChecked) {
                    row.classList.add('bg-green-50');
                } else {
                    row.classList.remove('bg-green-50');
                }
                
                updateChecklistStats();
                saveChecklistToStorage();
            }
            
            function toggleSelectAllChecklist(event) {
                const isChecked = event.target.checked;
                const checkboxes = document.querySelectorAll('.item-checkbox');
                
                checkboxes.forEach((checkbox, index) => {
                    checkbox.checked = isChecked;
                    if (isChecked) {
                        checklistChecked.add(index);
                    } else {
                        checklistChecked.delete(index);
                    }
                    
                    // Atualizar cor da linha
                    const row = checkbox.closest('tr');
                    if (isChecked) {
                        row.classList.add('bg-green-50');
                    } else {
                        row.classList.remove('bg-green-50');
                    }
                });
                
                updateChecklistStats();
                saveChecklistToStorage();
            }
            
            function updateChecklistStats() {
                const total = checklistData.length;
                const checked = checklistChecked.size;
                const remaining = total - checked;
                
                document.getElementById('checklist-total').textContent = `Total: ${total}`;
                document.getElementById('checklist-checked').textContent = `Marcados: ${checked}`;
                document.getElementById('checklist-remaining').textContent = `Restantes: ${remaining}`;
            }
            
            function clearChecklist() {
                if (confirm('Tem certeza que deseja limpar todo o checklist? Esta ação não pode ser desfeita.')) {
                    checklistData = [];
                    checklistChecked.clear();
                    localStorage.removeItem('checklist-data');
                    localStorage.removeItem('checklist-checked');
                    
                    // Voltar para a tabela normal
                    renderTable(filteredData);
                    
                    alert('Checklist limpo com sucesso!');
                }
            }
            
            function exportChecklist() {
                if (checklistChecked.size === 0) {
                    alert('Nenhum item selecionado para exportar.');
                    return;
                }
                
                const selectedItems = Array.from(checklistChecked).map(index => checklistData[index]);
                const csvContent = convertToCSV(selectedItems);
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `checklist_selecionados_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            function convertToCSV(data) {
                if (data.length === 0) return '';
                
                const headers = ['ID', 'Nome', 'Status', 'Tags', 'Validação'];
                const rows = data.map(item => [
                    item.id || '',
                    item.user?.name || '',
                    item.user?.status || '',
                    Object.entries(item.user?.tags || {}).map(([k, v]) => `${k}: ${v}`).join('; '),
                    item.isValidUser ? 'Válido' : 'Inválido'
                ]);
                
                const csvContent = [headers, ...rows]
                    .map(row => row.map(field => `"${field}"`).join(','))
                    .join('\n');
                
                return csvContent;
            }
            
            function saveChecklistToStorage() {
                localStorage.setItem('checklist-data', JSON.stringify(checklistData));
                localStorage.setItem('checklist-checked', JSON.stringify(Array.from(checklistChecked)));
            }
            
            function loadChecklistFromStorage() {
                const savedData = localStorage.getItem('checklist-data');
                const savedChecked = localStorage.getItem('checklist-checked');
                
                if (savedData) {
                    try {
                        checklistData = JSON.parse(savedData);
                        if (savedChecked) {
                            checklistChecked = new Set(JSON.parse(savedChecked));
                        }
                    } catch (e) {
                        console.error('Erro ao carregar checklist do localStorage:', e);
                    }
                }
            }
            
            function clearAllWidgets() {
                if (confirm('Tem certeza que deseja limpar todos os widgets do BI? Esta ação não pode ser desfeita.')) {
                    dashboardGrid.innerHTML = '';
                    widgetCounter = 0;
                    localStorage.removeItem('bi-widgets');
                    alert('Todos os widgets foram removidos!');
                }
            }

            // --- Funções de Persistência ---
            function saveWidgetsToStorage() {
                const widgets = Array.from(dashboardGrid.children).map(widget => {
                    const widgetData = widget.getAttribute('data-widget-data');
                    return widgetData ? JSON.parse(widgetData) : null;
                }).filter(Boolean);
                
                localStorage.setItem('bi-widgets', JSON.stringify(widgets));
                console.log('Widgets salvos no localStorage:', widgets);
            }
            
            function loadWidgetsFromStorage() {
                const savedWidgets = localStorage.getItem('bi-widgets');
                if (savedWidgets) {
                    try {
                        const widgets = JSON.parse(savedWidgets);
                        console.log('Widgets carregados do localStorage:', widgets);
                        
                        // Limpar widgets existentes
                        dashboardGrid.innerHTML = '';
                        widgetCounter = 0;
                        
                        // Recriar widgets salvos
                        widgets.forEach(widgetData => {
                            if (widgetData && fullData.length > 0) {
                                createWidgetFromData(widgetData);
                            }
                        });
                    } catch (e) {
                        console.error('Erro ao carregar widgets do localStorage:', e);
                    }
                }
            }
            
            function createWidgetFromData(widgetData) {
                const { title, type, filter, groupBy } = widgetData;
                
                // Aplicar filtro aos dados
                let dataForWidget = fullData;
                if (filter) {
                    try {
                        const convertedFilter = convertTagNotation(filter);
                        const filterFn = new Function('item', `try { return ${convertedFilter}; } catch(e) { return false; }`);
                        dataForWidget = fullData.filter(filterFn);
                    } catch (e) {
                        console.error("Erro no filtro do widget:", e);
                        return;
                    }
                }
                
                createWidget(title, type, dataForWidget, groupBy, { filter: filter, groupBy: groupBy });
            }

            // --- Lógica do Dashboard B.I. ---
            function handleAddWidget(event) {
                event.preventDefault();
                if (fullData.length === 0) {
                    alert("Por favor, carregue um arquivo JSON primeiro.");
                    return;
                }

                const title = document.getElementById('widget-title').value;
                const type = document.getElementById('widget-type').value;
                let filter = document.getElementById('widget-filter').textContent.trim();
                let groupBy = document.getElementById('widget-group-by').textContent.trim();
                
                // Limpar placeholders
                if (filter === document.getElementById('widget-filter').getAttribute('data-placeholder')) {
                    filter = '';
                }
                if (groupBy === document.getElementById('widget-group-by').getAttribute('data-placeholder')) {
                    groupBy = '';
                }

                // Agrupamento agora é opcional - se não especificado, mostra total
                // if ((type === 'pie' || type === 'bar') && !groupBy) {
                //     alert("Para gráficos de Pizza ou Coluna, o campo 'Agrupar por' é obrigatório.");
                //     return;
                // }

                let dataForWidget = fullData;
                if (filter) {
                    try {
                        const convertedFilter = convertTagNotation(filter);
                        const filterFn = new Function('item', `try { return ${convertedFilter}; } catch(e) { return false; }`);
                        dataForWidget = fullData.filter(filterFn);
                    } catch (e) {
                        alert("Erro na sintaxe do filtro. Verifique o console para mais detalhes.");
                        console.error("Erro no filtro do widget:", e);
                        return;
                    }
                }
                
                createWidget(title, type, dataForWidget, groupBy, { filter: filter, groupBy: groupBy });
                
                // Salvar widgets no localStorage
                saveWidgetsToStorage();
                
                addWidgetForm.reset();
                const widgetFilter = document.getElementById('widget-filter');
                const widgetGroupBy = document.getElementById('widget-group-by');
                
                widgetFilter.textContent = widgetFilter.getAttribute('data-placeholder');
                widgetFilter.style.color = '#9ca3af';
                widgetGroupBy.textContent = widgetGroupBy.getAttribute('data-placeholder');
                widgetGroupBy.style.color = '#9ca3af';
                
                document.getElementById('widget-filter-highlights').innerHTML = '';
                document.getElementById('widget-group-by-highlights').innerHTML = '';
                groupByContainer.classList.add('hidden');
            }

            function createWidget(title, type, data, groupBy, widgetData = null) {
                widgetCounter++;
                const widgetId = `widget-canvas-${widgetCounter}`;
                const widgetWrapper = document.createElement('div');
                widgetWrapper.className = 'bg-white p-6 rounded-lg shadow-md flex flex-col relative group';
                widgetWrapper.setAttribute('data-widget-id', widgetId);
                
                // Botões de ação (aparecem no hover)
                const actionButtons = `
                    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                        <button onclick="editWidget('${widgetId}')" class="p-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-colors" title="Editar widget">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button onclick="deleteWidget('${widgetId}')" class="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors" title="Excluir widget">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                `;
                
                let contentHtml = `
                    ${actionButtons}
                    <h3 class="text-lg font-semibold text-slate-800 mb-4 pr-8">${title}</h3>
                `;
                
                switch(type) {
                    case 'number':
                        contentHtml += `<div class="text-5xl font-bold text-blue-600 text-center my-auto">${data.length}</div>`;
                        break;
                    case 'pie':
                    case 'bar':
                        contentHtml += `<div class="flex-grow"><canvas id="${widgetId}"></canvas></div>`;
                        break;
                }
                
                widgetWrapper.innerHTML = contentHtml;
                dashboardGrid.appendChild(widgetWrapper);

                // Armazenar dados do widget para edição
                widgetWrapper.setAttribute('data-widget-data', JSON.stringify({
                    title: title,
                    type: type,
                    filter: widgetData?.filter || '',
                    groupBy: widgetData?.groupBy || ''
                }));

                if (type === 'pie' || type === 'bar') {
                    renderChart(widgetId, type, data, groupBy);
                }
                
                // Salvar widgets no localStorage
                saveWidgetsToStorage();
            }

            function createPredefinedWidgets() {
                if (Object.keys(statistics).length === 0) return;
                
                // Widget de Total de Usuários
                createWidget('Total de Usuários', 'number', Array(statistics.totalUsers).fill({}));
                
                // Widget de Distribuição por Status de Tags
                const tagDistribution = [
                    { label: 'Com Tags', value: statistics.taggedUsers },
                    { label: 'Sem Tags', value: statistics.totalUsers - statistics.taggedUsers }
                ];
                createPieChart('Distribuição por Tags', tagDistribution);
                
                // Widget de Validação de Nomes
                const nameValidation = [
                    { label: 'Nomes Válidos', value: statistics.validNameTaggedUsers + statistics.validNameUntaggedUsers },
                    { label: 'Nomes Inválidos', value: statistics.invalidNameUsers }
                ];
                createPieChart('Validação de Nomes', nameValidation);
            }

            function createPieChart(title, data) {
                widgetCounter++;
                const widgetId = `widget-canvas-${widgetCounter}`;
                const widgetWrapper = document.createElement('div');
                widgetWrapper.className = 'bg-white p-6 rounded-lg shadow-md flex flex-col';
                
                widgetWrapper.innerHTML = `
                    <h3 class="text-lg font-semibold text-slate-800 mb-4">${title}</h3>
                    <div class="flex-grow"><canvas id="${widgetId}"></canvas></div>
                `;
                
                dashboardGrid.appendChild(widgetWrapper);
                
                const ctx = document.getElementById(widgetId).getContext('2d');
                const labels = data.map(item => item.label);
                const values = data.map(item => item.value);
                const backgroundColors = labels.map((_, i) => `hsl(${(i * 360 / labels.length)}, 70%, 60%)`);

                new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: backgroundColors,
                            borderColor: '#fff',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            }
                        }
                    }
                });
            }

            function renderChart(canvasId, type, data, groupBy) {
                const ctx = document.getElementById(canvasId).getContext('2d');
                
                // Se não há dados, mostrar mensagem
                if (!data || data.length === 0) {
                    ctx.fillStyle = '#6b7280';
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Nenhum dado para exibir', ctx.canvas.width / 2, ctx.canvas.height / 2);
                    return;
                }
                
                // Se não há groupBy, agrupar por contagem simples
                if (!groupBy || groupBy.trim() === '') {
                    const groupedData = { 'Total': data.length };
                    renderSimpleChart(ctx, type, groupedData);
                    return;
                }
                
                // Processar múltiplos campos de agrupamento (separados por vírgula)
                const groupFields = groupBy.split(',').map(field => field.trim()).filter(field => field);
                
                if (groupFields.length === 1) {
                    // Agrupamento simples
                    const groupedData = groupDataByField(data, groupFields[0]);
                    renderSimpleChart(ctx, type, groupedData);
                } else {
                    // Agrupamento múltiplo
                    const groupedData = groupDataByMultipleFields(data, groupFields);
                    renderMultipleFieldsChart(ctx, type, groupedData, groupFields);
                }
            }
            
            function groupDataByField(data, field) {
                const convertedField = convertTagNotation(field);
                return data.reduce((acc, item) => {
                    const key = getValueByPath(item, convertedField.replace('item.', '')) || 'Não definido';
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {});
            }
            
            function groupDataByMultipleFields(data, fields) {
                return data.reduce((acc, item) => {
                    const keyParts = fields.map(field => {
                        const convertedField = convertTagNotation(field);
                        const value = getValueByPath(item, convertedField.replace('item.', '')) || 'Não definido';
                        return value;
                    });
                    const key = keyParts.join(' | ');
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {});
            }
            
            function renderSimpleChart(ctx, type, groupedData) {
                const labels = Object.keys(groupedData);
                const values = Object.values(groupedData);
                const backgroundColors = labels.map((_, i) => `hsl(${(i * 360 / labels.length)}, 70%, 60%)`);

                new Chart(ctx, {
                    type: type,
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Contagem',
                            data: values,
                            backgroundColor: type === 'pie' ? backgroundColors : 'rgba(59, 130, 246, 0.7)',
                            borderColor: type === 'pie' ? '#fff' : 'rgba(59, 130, 246, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: type === 'pie' ? 'top' : 'none',
                                labels: {
                                    usePointStyle: true,
                                    padding: 15
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        scales: type === 'bar' ? {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        } : {}
                    }
                });
            }
            
            function renderMultipleFieldsChart(ctx, type, groupedData, fields) {
                const labels = Object.keys(groupedData);
                const values = Object.values(groupedData);
                const backgroundColors = labels.map((_, i) => `hsl(${(i * 360 / labels.length)}, 70%, 60%)`);

                new Chart(ctx, {
                    type: type,
                    data: {
                        labels: labels,
                        datasets: [{
                            label: `Agrupado por: ${fields.join(', ')}`,
                            data: values,
                            backgroundColor: type === 'pie' ? backgroundColors : 'rgba(59, 130, 246, 0.7)',
                            borderColor: type === 'pie' ? '#fff' : 'rgba(59, 130, 246, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: type === 'pie' ? 'top' : 'none',
                                labels: {
                                    usePointStyle: true,
                                    padding: 15,
                                    maxWidth: 200,
                                    generateLabels: function(chart) {
                                        const data = chart.data;
                                        if (data.labels.length > 10) {
                                            return data.labels.slice(0, 10).map((label, i) => ({
                                                text: label.length > 20 ? label.substring(0, 20) + '...' : label,
                                                fillStyle: data.datasets[0].backgroundColor[i],
                                                hidden: false,
                                                index: i
                                            }));
                                        }
                                        return data.labels.map((label, i) => ({
                                            text: label,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            hidden: false,
                                            index: i
                                        }));
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        scales: type === 'bar' ? {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            },
                            x: {
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            }
                        } : {}
                    }
                });
            }

            // --- Lógica do Visualizador de Dados (Tabela) ---
            function handleFileSelect(event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    infoArea.classList.add('hidden');
                    loader.style.display = 'flex';
                    dataContainer.innerHTML = '';
                    resultsCountEl.textContent = '';
                    setTimeout(() => {
                        try {
                            const data = JSON.parse(e.target.result);
                            fullData = data.statisticUserlivePlate || [];
                            filteredData = [...fullData];
                            
                            // Capturar estatísticas gerais
                            statistics = {
                                totalUsers: data.totalUsers || 0,
                                taggedUsers: data.taggedUsers || 0,
                                validNameUntaggedUsers: data.validNameUntaggedUsers || 0,
                                validNameTaggedUsers: data.validNameTaggedUsers || 0,
                                validNameUntaggedUsersWithFavoriteStation: data.validNameUntaggedUsersWithFavoriteStation || 0,
                                invalidNameUsers: data.invalidNameUsers || 0,
                                invalidNameTaggedUsers: data.invalidNameTaggedUsers || 0
                            };
                            
                            if (fullData.length > 0) {
                                headers = getHeadersFromData(fullData[0]);
                                extractAllTagKeys();
                                
                                // Reinicializar inputs inteligentes para incluir as tags
                                smartInputsInitialized = false;
                                initializeSmartInputs();
                                
                                renderStatistics();
                                renderTable(filteredData);
                                
                                // Limpar widgets antigos quando carregar novo arquivo
                                dashboardGrid.innerHTML = '';
                                widgetCounter = 0;
                                
                                // Carregar widgets salvos do localStorage
                                loadWidgetsFromStorage();
                                
                                // Carregar checklist salvo
                                loadChecklistFromStorage();
                            } else {
                                showInfo('O arquivo JSON está vazio ou não contém a chave "statisticUserlivePlate".');
                            }
                        } catch (error) {
                            console.error("Erro ao analisar JSON:", error);
                            showInfo('Erro ao ler o arquivo. Verifique se é um JSON válido.', 'error');
                        } finally {
                            loader.style.display = 'none';
                        }
                    }, 500);
                };
                reader.readAsText(file);
            }
            
            function applyTableFilter() {
                let expression = filterExpressionInput.textContent.trim();
                if (!expression || expression === filterExpressionInput.getAttribute('data-placeholder')) {
                    filteredData = [...fullData];
                    renderTable(filteredData);
                    return;
                }
                try {
                    const convertedExpression = convertTagNotation(expression);
                    const filterFn = new Function('item', `try { return ${convertedExpression}; } catch (e) { return false; }`);
                    filteredData = fullData.filter(filterFn);
                } catch (error) {
                    alert("A expressão de filtro contém um erro de sintaxe.");
                    return;
                }
                renderTable(filteredData);
            }

            function clearTableFilter() {
                filterExpressionInput.textContent = filterExpressionInput.getAttribute('data-placeholder');
                filterExpressionInput.style.color = '#9ca3af';
                document.getElementById('filter-expression-highlights').innerHTML = '';
                filteredData = [...fullData];
                renderTable(filteredData);
            }
            
            function renderTable(data) {
                dataContainer.innerHTML = '';
                resultsCountEl.textContent = `Exibindo ${data.length} de ${fullData.length} registros.`;
                if(data.length === 0 && fullData.length > 0) {
                    dataContainer.innerHTML = `<p class="text-center text-slate-500 mt-8">Nenhum resultado encontrado.</p>`;
                    return;
                }
                if (fullData.length === 0) return;

                const primaryColumns = ['user.nome_completo', 'user.telefone_celular'];
                const tagsColumn = 'user.tags';
                const statusBooleans = ['isTaggedUser', 'isValidUser', 'hasFavoriteStation'];

                const allOtherColumns = headers.filter(h => 
                    !primaryColumns.includes(h) && 
                    !statusBooleans.includes(h) &&
                    h !== tagsColumn
                );

                const displayHeaders = ['Nome', 'Telefone', 'Tags', 'Tagged', 'Válido', 'Posto Favorito', ...allOtherColumns.map(h => h.replace('user.', ''))];

                const tableContainer = document.createElement('div');
                tableContainer.id = 'table-container';
                const table = document.createElement('table');
                table.className = 'min-w-full divide-y divide-slate-200';
                
                const thead = document.createElement('thead');
                thead.className = 'bg-slate-50 sticky top-0';
                let headerHtml = '<tr>';
                displayHeaders.forEach(h => {
                    headerHtml += `<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">${h}</th>`
                });
                thead.innerHTML = headerHtml + '</tr>';
                
                const tbody = document.createElement('tbody');
                tbody.className = 'bg-white divide-y divide-slate-200';
                let tbodyHtml = '';
                
                data.forEach(item => {
                    tbodyHtml += '<tr>';

                    // Colunas primárias
                    primaryColumns.forEach(col => {
                        const value = getValueByPath(item, col);
                        tbodyHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 align-top">${formatValueForDisplay(value)}</td>`;
                    });
                    
                    // Coluna Tags - Miniplanilha
                    const tags = getValueByPath(item, tagsColumn);
                    tbodyHtml += `<td class="px-6 py-4 text-sm text-slate-500 align-top">`;
                    if (tags && Object.keys(tags).length > 0) {
                        tbodyHtml += createTagMiniSheet(tags);
                    } else {
                        tbodyHtml += '<div class="text-xs text-slate-400 italic">Sem tags</div>';
                    }
                    tbodyHtml += '</td>';

                    // Colunas de Status Booleanos
                    statusBooleans.forEach(col => {
                         const value = getValueByPath(item, col);
                         tbodyHtml += `<td class="px-6 py-4 text-sm text-slate-500 align-top"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${value ? 'Sim' : 'Não'}</span></td>`;
                    });

                    // Demais colunas
                    allOtherColumns.forEach(header => {
                        const value = getValueByPath(item, header);
                        tbodyHtml += `<td class="px-6 py-4 text-sm text-slate-500 break-all align-top">${formatValueForDisplay(value)}</td>`;
                    });

                    tbodyHtml += '</tr>';
                });

                tbody.innerHTML = tbodyHtml;
                table.append(thead, tbody);
                tableContainer.append(table);
                dataContainer.append(tableContainer);
            }

            // --- Função de Tela Cheia ---
            function toggleFullscreen() {
                const dataContainer = document.getElementById('data-container');
                const isFullscreen = dataContainer.classList.contains('fullscreen-mode');
                
                if (isFullscreen) {
                    // Sair do modo tela cheia
                    dataContainer.classList.remove('fullscreen-mode');
                    fullscreenIcon.textContent = '⛶';
                    fullscreenText.textContent = 'Tela Cheia';
                    
                    // Remover overlay se existir
                    const overlay = document.querySelector('.fullscreen-overlay');
                    if (overlay) {
                        overlay.remove();
                    }
                    
                    // Remover event listener do ESC
                    document.removeEventListener('keydown', handleEscapeKey);
                } else {
                    // Entrar no modo tela cheia
                    dataContainer.classList.add('fullscreen-mode');
                    fullscreenIcon.textContent = '❌';
                    fullscreenText.textContent = 'Sair da Tela Cheia';
                    
                    // Adicionar overlay de fundo
                    const overlay = document.createElement('div');
                    overlay.className = 'fullscreen-overlay';
                    overlay.innerHTML = '<div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); color: white; font-size: 14px; background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 6px;">Pressione ESC para sair da tela cheia</div>';
                    document.body.appendChild(overlay);
                    
                    // Fechar com ESC
                    document.addEventListener('keydown', handleEscapeKey);
                }
            }
            
            function handleEscapeKey(e) {
                if (e.key === 'Escape') {
                    toggleFullscreen();
                }
            }
            
            // Funções globais para editar e excluir widgets
            window.editWidget = function(widgetId) {
                const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
                if (!widget) return;
                
                const widgetData = JSON.parse(widget.getAttribute('data-widget-data'));
                
                // Preencher o modal de edição
                document.getElementById('edit-widget-title').value = widgetData.title;
                document.getElementById('edit-widget-type').value = widgetData.type;
                document.getElementById('edit-widget-filter').textContent = widgetData.filter || '';
                document.getElementById('edit-widget-group-by').textContent = widgetData.groupBy || '';
                
                // Mostrar modal
                document.getElementById('edit-widget-modal').classList.remove('hidden');
                
                // Armazenar ID do widget sendo editado
                document.getElementById('edit-widget-modal').setAttribute('data-editing-widget', widgetId);
            };
            
            window.deleteWidget = function(widgetId) {
                if (confirm('Tem certeza que deseja excluir este widget?')) {
                    const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
                    if (widget) {
                        widget.remove();
                        saveWidgetsToStorage();
                    }
                }
            };

            // --- Funções Utilitárias ---
            function renderStatistics() {
                document.getElementById('statistics-section').classList.remove('hidden');
                document.getElementById('stat-total-users').textContent = statistics.totalUsers.toLocaleString();
                document.getElementById('stat-tagged-users').textContent = statistics.taggedUsers.toLocaleString();
                document.getElementById('stat-valid-tagged').textContent = statistics.validNameTaggedUsers.toLocaleString();
                document.getElementById('stat-invalid-users').textContent = statistics.invalidNameUsers.toLocaleString();
                document.getElementById('stat-valid-untagged').textContent = statistics.validNameUntaggedUsers.toLocaleString();
                document.getElementById('stat-valid-untagged-fav').textContent = statistics.validNameUntaggedUsersWithFavoriteStation.toLocaleString();
                document.getElementById('stat-invalid-tagged').textContent = statistics.invalidNameTaggedUsers.toLocaleString();
                
                // Adicionar informação sobre tags encontradas
                const tagInfo = document.createElement('div');
                tagInfo.className = 'mt-4 p-3 bg-blue-50 rounded-lg';
                tagInfo.innerHTML = `
                    <div class="text-sm font-semibold text-blue-800">🏷️ Tags Encontradas no Arquivo</div>
                    <div class="text-xs text-blue-600 mt-1">${allTagKeys.size} tipos de tags diferentes: ${Array.from(allTagKeys).join(', ')}</div>
                `;
                document.getElementById('statistics-section').appendChild(tagInfo);
            }

            function showInfo(message, type = 'info') {
                infoArea.classList.remove('hidden');
                infoArea.innerHTML = `<p class="${type === 'error' ? 'text-red-500' : 'text-slate-500'}">${message}</p>`;
            }

            function getHeadersFromData(obj) {
                const keys = new Set();
                function recurse(current, path) {
                    if (Object(current) !== current || current === null) return;
                    Object.keys(current).forEach(key => {
                        const newPath = path ? `${path}.${key}` : key;
                        if (Object(current[key]) === current[key] && !Array.isArray(current[key]) && current[key] !== null) {
                            recurse(current[key], newPath);
                        } else {
                            keys.add(newPath);
                        }
                    });
                }
                recurse(obj, '');
                return Array.from(keys);
            }

            function getValueByPath(obj, path) {
                // Função que funciona com notação de colchetes
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
            
            function convertTagNotation(expression) {
                // NÃO converter as chaves das tags - manter a notação original
                // A função getValueByPath já lida com notação de colchetes corretamente
                return expression;
            }
            

            function formatValueForDisplay(value) {
                if (value === null || value === undefined) return '<span class="text-slate-400">N/A</span>';
                if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
                if (typeof value === 'object') return `<pre class="bg-slate-100 p-2 rounded text-xs whitespace-pre-wrap">${JSON.stringify(value, null, 2)}</pre>`;
                return value.toString();
            }
            
            function createTagMiniSheet(tags) {
                const tagEntries = Object.entries(tags);
                if (tagEntries.length === 0) {
                    return '<div class="text-xs text-slate-400 italic">Sem tags</div>';
                }
                
                let html = '<div class="tag-minisheet">';
                
                // Cabeçalho da miniplanilha
                html += '<div class="bg-slate-50 border border-slate-200 rounded-t-md">';
                html += '<div class="grid grid-cols-2 gap-2 px-2 py-1 text-xs font-semibold text-slate-600 border-b border-slate-200">';
                html += '<div>Chave</div><div>Valor</div>';
                html += '</div>';
                html += '</div>';
                
                // Corpo da miniplanilha
                html += '<div class="border-l border-r border-b border-slate-200 rounded-b-md max-h-32 overflow-y-auto">';
                
                tagEntries.forEach(([key, value], index) => {
                    const bgColor = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    html += `<div class="grid grid-cols-2 gap-2 px-2 py-1 text-xs ${bgColor} hover:bg-blue-50 transition-colors">`;
                    html += `<div class="font-medium text-slate-700 truncate" title="${key}">${key}</div>`;
                    html += `<div class="text-slate-600 truncate" title="${value}">${value}</div>`;
                    html += '</div>';
                });
                
                html += '</div>';
                html += '</div>';
                
                return html;
            }

            // Funções globais para editar e excluir widgets
            window.editWidget = function(widgetId) {
                const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
                if (!widgetElement) return;
                
                const widgetData = JSON.parse(widgetElement.getAttribute('data-widget-data'));
                
                // Preencher o modal com os dados atuais
                document.getElementById('edit-widget-title').value = widgetData.title;
                document.getElementById('edit-widget-type').value = widgetData.type;
                
                const filterEditor = document.getElementById('edit-widget-filter');
                const groupByEditor = document.getElementById('edit-widget-group-by');
                
                filterEditor.textContent = widgetData.filter || filterEditor.getAttribute('data-placeholder');
                filterEditor.style.color = widgetData.filter ? 'black' : '#9ca3af';
                
                groupByEditor.textContent = widgetData.groupBy || groupByEditor.getAttribute('data-placeholder');
                groupByEditor.style.color = widgetData.groupBy ? 'black' : '#9ca3af';
                
                // Mostrar/ocultar campo de agrupamento
                const groupByContainer = document.getElementById('edit-group-by-container');
                groupByContainer.classList.toggle('hidden', widgetData.type === 'number');
                
                // Armazenar ID do widget sendo editado
                document.getElementById('edit-widget-modal').setAttribute('data-editing-widget', widgetId);
                
                // Mostrar modal
                document.getElementById('edit-widget-modal').classList.remove('hidden');
                
                // Inicializar highlights
                updateHighlightsForEditor('edit-widget-filter');
                updateHighlightsForEditor('edit-widget-group-by');
            };

            window.deleteWidget = function(widgetId) {
                if (confirm('Tem certeza que deseja excluir este widget?')) {
                    const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
                    if (widgetElement) {
                        widgetElement.remove();
                    }
                }
            };

            window.closeEditModal = function() {
                document.getElementById('edit-widget-modal').classList.add('hidden');
                document.getElementById('edit-widget-modal').removeAttribute('data-editing-widget');
            };

            function handleEditWidget(event) {
                event.preventDefault();
                
                const editingWidgetId = document.getElementById('edit-widget-modal').getAttribute('data-editing-widget');
                if (!editingWidgetId) return;
                
                const title = document.getElementById('edit-widget-title').value;
                const type = document.getElementById('edit-widget-type').value;
                let filter = document.getElementById('edit-widget-filter').textContent.trim();
                let groupBy = document.getElementById('edit-widget-group-by').textContent.trim();
                
                // Limpar placeholders
                if (filter === document.getElementById('edit-widget-filter').getAttribute('data-placeholder')) {
                    filter = '';
                }
                if (groupBy === document.getElementById('edit-widget-group-by').getAttribute('data-placeholder')) {
                    groupBy = '';
                }
                
                // Agrupamento agora é opcional - se não especificado, mostra total
                // if ((type === 'pie' || type === 'bar') && !groupBy) {
                //     alert("Para gráficos de Pizza ou Coluna, o campo 'Agrupar por' é obrigatório.");
                //     return;
                // }
                
                // Aplicar filtro aos dados
                let dataForWidget = fullData;
                if (filter) {
                    try {
                        const convertedFilter = convertTagNotation(filter);
                        const filterFn = new Function('item', `try { return ${convertedFilter}; } catch(e) { return false; }`);
                        dataForWidget = fullData.filter(filterFn);
                    } catch (e) {
                        alert("Erro na sintaxe do filtro. Verifique o console para mais detalhes.");
                        console.error("Erro no filtro do widget:", e);
                        return;
                    }
                }
                
                // Encontrar e remover o widget antigo
                const oldWidget = document.querySelector(`[data-widget-id="${editingWidgetId}"]`);
                if (oldWidget) {
                    oldWidget.remove();
                }
                
                // Criar novo widget com os dados atualizados
                createWidget(title, type, dataForWidget, groupBy, { filter: filter, groupBy: groupBy });
                
                // Salvar widgets no localStorage
                saveWidgetsToStorage();
                
                // Fechar modal
                closeEditModal();
            }

            function updateHighlightsForEditor(editorId) {
                const editor = document.getElementById(editorId);
                const highlights = document.getElementById(`${editorId}-highlights`);
                
                if (!editor || !highlights) return;
                
                const text = editor.textContent;
                if (text.trim() === '' || text === editor.getAttribute('data-placeholder')) {
                    highlights.innerHTML = '';
                    return;
                }
                
                const highlightedText = text.replace(/(item\.[a-zA-Z0-9_.]+)/g, (match) => {
                    if (suggestionHeaders.includes(match)) {
                        return `<span class="valid-keyword">${match}</span>`;
                    }
                    return `<span class="invalid-keyword">${match}</span>`;
                }).replace(/\n/g, '<br>');
                highlights.innerHTML = highlightedText;
            }
        });

