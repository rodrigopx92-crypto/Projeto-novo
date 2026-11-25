/* =========================================================
   CONFIGURAÇÃO E CONEXÃO COM O FIREBASE
   ========================================================= */
const TEMPO_SESSAO_NORMAL = 1000 * 60 * 60 * 4;
const APP_VERSAO = 'v9.0';

const firebaseConfig = {
    apiKey: "AIzaSyDD9DqoucWmYXrKCGmPStWHLO1TJgZK_P8",
    authDomain: "intense-pointer-244217.firebaseapp.com",
    projectId: "intense-pointer-244217",
    storageBucket: "intense-pointer-244217.firebasestorage.app",
    messagingSenderId: "187681091593",
    appId: "1:187681091593:web:392f64c159774e51a848d8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const $ = (id) => document.getElementById(id);
const carregar = (chave) => JSON.parse(localStorage.getItem(chave)) || [];
const salvar = (chave, dados) => localStorage.setItem(chave, JSON.stringify(dados));
const formatarMoeda = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
const formatarData = (iso) => !iso ? '—' : iso.split('-').reverse().join('/');
const hojeStr = () => new Date().toISOString().split('T')[0];

// Variáveis de estado para filtros
let filtroAtualAgendamentos = { paciente: '', dataInicio: '', dataFim: '', status: 'todos' };
let filtroEstoqueAtual = 'todos';
let filtroPagamentoAtual = 'todos';
let filtroLogsAtual = 'todos';

async function registrarLog(acao, detalhe) {
    try {
        const sessao = JSON.parse(localStorage.getItem('sessao'));
        const usuarios = carregar('usuarios');
        const user = usuarios.find(u => u.id === sessao?.usuarioId) || { nome: 'Desconhecido', email: '-' };
        await db.collection('logs').add({ data: new Date().toLocaleString('pt-BR'), usuario: user.nome, email: user.email, acao: acao, detalhe: detalhe });
        if ($('tela-logs') && $('tela-logs').classList.contains('ativa')) renderLogs();
    } catch (e) { console.error('Erro ao registrar log:', e); }
}

function gerarSalt() { const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(''); }
async function hashSenha(senha, salt) { const enc = new TextEncoder(); const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(senha), { name: 'PBKDF2' }, false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256); return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join(''); }
async function verificarSenha(senha, usuario) { const hash = await hashSenha(senha, usuario.salt); return hash === usuario.senhaHash; }

/* =========================================================
   SEED E INICIALIZAÇÃO
   ========================================================= */
async function popularFirebaseSeVazio() {
    try {
        const snapPac = await db.collection('pacientes').limit(1).get();
        if (snapPac.empty) {
            const nomesM = ['Pedro','Lucas','Gabriel','Matheus','Rafael','Bruno','Felipe','Thiago','Diego','Rodrigo'];
            const nomesF = ['Ana','Beatriz','Carla','Daniela','Eduarda','Fernanda','Gabriela','Helena','Isabela','Júlia'];
            const sobrenomes = ['Silva','Santos','Oliveira','Souza','Lima','Costa','Ferreira','Almeida'];
            const batchPac = db.batch();
            for (let i = 1; i <= 40; i++) {
                const lista = Math.random() > 0.5 ? nomesM : nomesF;
                const nome = lista[Math.floor(Math.random() * lista.length)] + ' ' + sobrenomes[Math.floor(Math.random() * sobrenomes.length)];
                const docRef = db.collection('pacientes').doc();
                batchPac.set(docRef, { nome: nome, telefone: `(11) 9${String(8000 + i).slice(-4)}-${String(1000 + i).slice(-4)}`, email: nome.toLowerCase().replace(/\s+/g, '.') + '@email.com', nascimento: `19${80 + Math.floor(Math.random() * 20)}-01-01` });
            }
            await batchPac.commit();
        }
        const snapEst = await db.collection('estoque').limit(1).get();
        if (snapEst.empty) {
            const itens = [
                { nome: 'Paracetamol 500mg', categoria: 'Medicamento', quantidade: 45, minimo: 20, preco: 8.50, validade: '2026-12-31' },
                { nome: 'Dipirona 1g', categoria: 'Medicamento', quantidade: 12, minimo: 20, preco: 6.20, validade: '2025-10-10' },
                { nome: 'Amoxicilina 500mg', categoria: 'Antibiótico', quantidade: 8, minimo: 10, preco: 28.90, validade: '2027-01-01' },
                { nome: 'Luvas descartáveis', categoria: 'Descartável', quantidade: 22, minimo: 15, preco: 22.00, validade: '2028-05-20' },
                { nome: 'Máscaras cirúrgicas', categoria: 'Descartável', quantidade: 6, minimo: 10, preco: 18.50, validade: '2026-11-30' },
                { nome: 'Álcool 70%', categoria: 'Higiene', quantidade: 60, minimo: 25, preco: 9.90, validade: '2027-08-15' }
            ];
            for (const item of itens) await db.collection('estoque').add(item);
        }
        const snapFor = await db.collection('fornecedores').limit(1).get();
        if (snapFor.empty) {
            await db.collection('fornecedores').add({ nome: 'MedPharma', cnpj: '11.111.111/0001-11', contato: 'Roberto', telefone: '(11) 3333-1001' });
            await db.collection('fornecedores').add({ nome: 'FarmaDist', cnpj: '22.222.222/0001-22', contato: 'Ana Costa', telefone: '(11) 3333-1002' });
        }
        const snapPro = await db.collection('profissionais').limit(1).get();
        if (snapPro.empty) {
            await db.collection('profissionais').add({ nome: 'Dra. Ana Souza', especialidade: 'Clínica Geral', telefone: '(11) 99999-1111', email: 'ana@clinica.com' });
            await db.collection('profissionais').add({ nome: 'Dr. Carlos Lima', especialidade: 'Cardiologia', telefone: '(11) 99999-2222', email: 'carlos@clinica.com' });
        }
        const snapSer = await db.collection('servicos').limit(1).get();
        if (snapSer.empty) {
            await db.collection('servicos').add({ nome: 'Consulta Clínica Geral', preco: 250.00, duracao: 30, descricao: 'Consulta padrão' });
            await db.collection('servicos').add({ nome: 'Consulta Cardiologia', preco: 350.00, duracao: 45, descricao: 'Consulta com especialista' });
        }
        if (carregar('usuarios').length === 0) {
            const salt = gerarSalt(); const hash = await hashSenha('admin123', salt);
            salvar('usuarios', [{ id: 'usr_admin', nome: 'Administrador', email: 'admin@clinica.com', senhaHash: hash, salt: salt, perfil: 'admin', ativo: true }]);
        }
    } catch (e) { console.error("Erro no seed:", e); }
}

/* =========================================================
   GERADOR DE MASSA DE DADOS
   ========================================================= */
window.gerarMassaDeDados = async () => {
    if (!confirm('Isso vai gerar centenas de registros no Firebase. Deseja continuar? (Pode demorar alguns segundos)')) return;

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ Gerando dados (aguarde)...';

    try {
        const especialidades = ['Cardiologia', 'Dermatologia', 'Pediatria', 'Ortopedia', 'Neurologia', 'Ginecologia', 'Oftalmologia', 'Psiquiatria'];
        const nomesPro = ['Dr. Ricardo', 'Dra. Beatriz', 'Dr. Marcelo', 'Dra. Camila', 'Dr. Fernando', 'Dra. Letícia', 'Dr. Paulo', 'Dra. Juliana', 'Dr. André', 'Dra. Mariana', 'Dr. Felipe', 'Dra. Amanda', 'Dr. Lucas', 'Dra. Bruna', 'Dr. Thiago'];
        
        const proIds = [];
        for (let i = 0; i < nomesPro.length; i++) {
            const doc = await db.collection('profissionais').add({
                nome: nomesPro[i], especialidade: especialidades[Math.floor(Math.random() * especialidades.length)],
                telefone: `(11) 98888-${String(1000 + i).slice(-4)}`, email: nomesPro[i].toLowerCase().replace(' ', '.') + '@clinica.com'
            });
            proIds.push(doc.id);
        }

        const snapPac = await db.collection('pacientes').get();
        const pacIds = snapPac.docs.map(d => d.id);
        const snapSer = await db.collection('servicos').get();
        const servicos = snapSer.docs.map(d => ({ id: d.id, ...d.data() }));

        if (pacIds.length === 0) throw new Error("É preciso ter pacientes cadastrados primeiro.");

        const batchAg = db.batch();
        const agendamentosGerados = [];
        const hoje = new Date();

        for (let i = 0; i < 200; i++) {
            const diasDiferenca = Math.floor(Math.random() * 90) - 60;
            const dataAg = new Date(hoje);
            dataAg.setDate(dataAg.getDate() + diasDiferenca);
            
            const status = diasDiferenca < 0 ? (Math.random() > 0.2 ? 'realizado' : 'cancelado') : 'agendado';
            const hora = String(8 + Math.floor(Math.random() * 10)).padStart(2, '0') + ':00';
            const pacId = pacIds[Math.floor(Math.random() * pacIds.length)];
            const proId = proIds[Math.floor(Math.random() * proIds.length)];
            const ser = servicos[Math.floor(Math.random() * servicos.length)];

            const docRef = db.collection('agendamentos').doc();
            const novoAg = {
                pacienteId: pacId, profissionalId: proId, servicoId: ser.id,
                data: dataAg.toISOString().split('T')[0], hora: hora, status: status, obs: ''
            };
            batchAg.set(docRef, novoAg);
            agendamentosGerados.push({ id: docRef.id, ...novoAg, preco: ser.preco });
        }
        await batchAg.commit();

        const batchPag = db.batch();
        const agsRealizados = agendamentosGerados.filter(a => a.status === 'realizado');
        
        agsRealizados.forEach(ag => {
            if (Math.random() > 0.15) {
                const docRef = db.collection('pagamentos').doc();
                batchPag.set(docRef, {
                    agendamentoId: ag.id, valor: ag.preco,
                    forma: ['dinheiro', 'pix', 'debito', 'credito'][Math.floor(Math.random() * 4)],
                    status: Math.random() > 0.1 ? 'pago' : 'pendente',
                    data: ag.data, obs: 'Pagamento gerado automaticamente', usuario: 'Administrador'
                });
            }
        });
        await batchPag.commit();

        const snapEst = await db.collection('estoque').get();
        const estoqueIds = snapEst.docs.map(d => d.id);
        const batchMov = db.batch();

        for (let i = 0; i < 50; i++) {
            const tipo = Math.random() > 0.4 ? 'saida' : 'entrada';
            const diasDiferenca = Math.floor(Math.random() * 60) - 60;
            const dataMov = new Date(hoje);
            dataMov.setDate(dataMov.getDate() + diasDiferenca);

            const docRef = db.collection('movimentacoes').doc();
            batchMov.set(docRef, {
                itemId: estoqueIds[Math.floor(Math.random() * estoqueIds.length)],
                tipo: tipo, quantidade: Math.floor(Math.random() * 10) + 1,
                motivo: tipo === 'saida' ? 'uso' : 'compra',
                data: dataMov.toISOString().split('T')[0], usuario: 'Administrador', obs: 'Gerado automaticamente'
            });
        }
        await batchMov.commit();

        btn.textContent = '✅ Dados Gerados!';
        registrarLog('criar', 'Massa de dados de teste gerada');
        atualizarTudo();
        setTimeout(() => { btn.textContent = '🎲 Gerar Dados de Teste'; btn.disabled = false; }, 3000);
    } catch (error) {
        alert('Erro ao gerar dados: ' + error.message);
        btn.textContent = '🎲 Gerar Dados de Teste';
        btn.disabled = false;
    }
};

(async () => {
    if ($('loginForm')) {
        if (carregar('usuarios').length === 0) {
            const salt = gerarSalt(); const hash = await hashSenha('admin123', salt);
            salvar('usuarios', [{ id: 'usr_admin', nome: 'Administrador', email: 'admin@clinica.com', senhaHash: hash, salt: salt, perfil: 'admin', ativo: true }]);
        }
        $('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = $('usuario').value.toLowerCase().trim(); const senha = $('senha').value;
            const btn = $('btnEntrar');
            btn.disabled = true; btn.innerHTML = '<span>Verificando...</span>'; $('erro').style.display = 'none';
            const usuarios = carregar('usuarios');
            const user = usuarios.find(u => u.email === email && u.ativo);
            if (user && await verificarSenha(senha, user)) {
                localStorage.setItem('sessao', JSON.stringify({ logado: true, usuarioId: user.id, expira: Date.now() + TEMPO_SESSAO_NORMAL }));
                window.location.href = 'painel.html';
            } else {
                $('erro').style.display = 'block'; btn.disabled = false;
                btn.innerHTML = '<span class="arrow-in">→</span><span class="btn-text">Entrar no sistema</span><span class="arrow-out">→</span>';
            }
        });
        return;
    }

    if (!$('menu')) return;
    const sessao = JSON.parse(localStorage.getItem('sessao'));
    if (!sessao || !sessao.logado || Date.now() > sessao.expira) { window.location.href = 'index.html'; return; }

    await popularFirebaseSeVazio();

    $('btnSair').addEventListener('click', (e) => { e.preventDefault(); registrarLog('logout', 'Saiu do sistema'); localStorage.removeItem('sessao'); window.location.href = 'index.html'; });

    document.querySelectorAll('#menu a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#menu a').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
            $('tela-' + link.dataset.tela).classList.add('ativa');
            $('tituloTela').textContent = link.querySelector('span:last-child').textContent;
            atualizarTudo();
        });
    });

    // ==========================================
    // RENDERIZAÇÃO DE TABELAS
    // ==========================================
    async function renderProfissionais() {
        const tbody = $('tabelaProfissionais'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snapshot = await db.collection('profissionais').get();
            tbody.innerHTML = snapshot.empty ? '<tr><td colspan="5" style="text-align:center;">Nenhum profissional.</td></tr>' : '';
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));
            docs.forEach(p => {
                tbody.innerHTML += `<tr><td>${p.nome}</td><td>${p.especialidade}</td><td>${p.telefone || '-'}</td><td>${p.email || '-'}</td><td>
                    <button class="btn btn-info btn-sm" onclick="abrirModalEditar('profissionais','${p.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('profissionais','${p.id}')">🗑️</button>
                </td></tr>`;
            });
        } catch (error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function renderServicos() {
        const tbody = $('tabelaServicos'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snapshot = await db.collection('servicos').get();
            tbody.innerHTML = snapshot.empty ? '<tr><td colspan="5" style="text-align:center;">Nenhum serviço.</td></tr>' : '';
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));
            docs.forEach(s => {
                tbody.innerHTML += `<tr><td>${s.nome}</td><td>${formatarMoeda(s.preco)}</td><td>${s.duracao} min</td><td>${s.descricao || '-'}</td><td>
                    <button class="btn btn-info btn-sm" onclick="abrirModalEditar('servicos','${s.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('servicos','${s.id}')">🗑️</button>
                </td></tr>`;
            });
        } catch (error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function renderPacientes() {
        const tbody = $('tabelaPacientes'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snapshot = await db.collection('pacientes').get();
            tbody.innerHTML = snapshot.empty ? '<tr><td colspan="5" style="text-align:center;">Nenhum paciente.</td></tr>' : '';
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));
            docs.forEach(p => {
                tbody.innerHTML += `<tr><td>${p.nome}</td><td>${p.telefone || '-'}</td><td>${p.email || '-'}</td><td>${formatarData(p.nascimento)}</td><td>
                    <button class="btn btn-info btn-sm" onclick="abrirModalEditar('pacientes','${p.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('pacientes','${p.id}')">🗑️</button>
                </td></tr>`;
            });
        } catch (error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function renderEstoque() {
        const tbody = $('tabelaEstoque'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snap = await db.collection('estoque').get();
            const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            let html = '';
            itens.forEach(e => {
                const baixo = Number(e.quantidade) <= Number(e.minimo);
                const vencendo = e.validade && (new Date(e.validade) - new Date()) < (30 * 86400000);
                const vencido = e.validade && new Date(e.validade) < new Date();

                if (filtroEstoqueAtual === 'baixo' && !baixo) return;
                if (filtroEstoqueAtual === 'vencendo' && !vencendo) return;
                if (filtroEstoqueAtual === 'vencidos' && !vencido) return;

                html += `<tr><td>${e.nome}</td><td>${e.categoria || '-'}</td><td>${e.quantidade}</td><td>${e.minimo}</td>
                    <td><span class="badge ${baixo ? 'estoque-baixo' : 'estoque-ok'}">${baixo ? '⚠️ Baixo' : '✔ OK'}</span></td>
                    <td>${formatarMoeda(e.preco)}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="abrirModalEditar('estoque','${e.id}')">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="excluirItem('estoque','${e.id}')">🗑️</button>
                    </td></tr>`;
            });
            tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;">Nenhum item no filtro.</td></tr>';
            
            const tbodyRep = $('tabelaReposicao');
            if (tbodyRep) {
                let htmlRep = '';
                itens.forEach(e => {
                    if (Number(e.quantidade) <= Number(e.minimo)) {
                        htmlRep += `<tr><td>${e.nome}</td><td>${e.quantidade}</td><td>${e.minimo}</td><td>${Number(e.minimo) * 2 - Number(e.quantidade)}</td><td>Gerar compra</td></tr>`;
                    }
                });
                tbodyRep.innerHTML = htmlRep || '<tr><td colspan="5" style="text-align:center;">Nenhum item precisa de reposição. ✅</td></tr>';
            }
        } catch (error) { tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function renderFornecedores() {
        const tbody = $('tabelaFornecedores'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snap = await db.collection('fornecedores').get();
            tbody.innerHTML = snap.empty ? '<tr><td colspan="6" style="text-align:center;">Nenhum fornecedor.</td></tr>' : '';
            snap.forEach(doc => {
                const f = doc.data();
                tbody.innerHTML += `<tr><td>${f.nome}</td><td>${f.cnpj || '-'}</td><td>${f.contato || '-'}</td><td>${f.telefone || '-'}</td><td>${f.email || '-'}</td><td>
                    <button class="btn btn-info btn-sm" onclick="abrirModalEditar('fornecedores','${doc.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('fornecedores','${doc.id}')">🗑️</button>
                </td></tr>`;
            });
        } catch (error) { tbody.innerHTML = `<tr><td colspan="6" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function preencherSelectsAgendamento() {
        if (!$('agPaciente')) return;
        const snapPac = await db.collection('pacientes').get(); let htmlPac = '<option value="">Selecione…</option>'; snapPac.forEach(doc => { htmlPac += `<option value="${doc.id}">${doc.data().nome}</option>`; }); $('agPaciente').innerHTML = htmlPac;
        const snapPro = await db.collection('profissionais').get(); let htmlPro = '<option value="">Selecione…</option>'; snapPro.forEach(doc => { htmlPro += `<option value="${doc.id}">${doc.data().nome}</option>`; }); $('agProfissional').innerHTML = htmlPro;
        const snapSer = await db.collection('servicos').get(); let htmlSer = '<option value="">Selecione…</option>'; snapSer.forEach(doc => { htmlSer += `<option value="${doc.id}">${doc.data().nome}</option>`; }); $('agServico').innerHTML = htmlSer;
    }

    async function renderAgendamentos() {
        const tbody = $('tabelaAgendamentos'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snapshot = await db.collection('agendamentos').get();
            tbody.innerHTML = snapshot.empty ? '<tr><td colspan="7" style="text-align:center;">Nenhum agendamento.</td></tr>' : '';
            
            const snapPac = await db.collection('pacientes').get(); const pacs = {}; snapPac.forEach(d => pacs[d.id] = d.data().nome);
            const snapPro = await db.collection('profissionais').get(); const pros = {}; snapPro.forEach(d => pros[d.id] = d.data().nome);
            const snapSer = await db.collection('servicos').get(); const sers = {}; snapSer.forEach(d => sers[d.id] = d.data().nome);

            let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.data || '').localeCompare(b.data || ''));
            
            docs = docs.filter(a => {
                if (filtroAtualAgendamentos.paciente && !(pacs[a.pacienteId] || '').toLowerCase().includes(filtroAtualAgendamentos.paciente.toLowerCase())) return false;
                if (filtroAtualAgendamentos.dataInicio && a.data < filtroAtualAgendamentos.dataInicio) return false;
                if (filtroAtualAgendamentos.dataFim && a.data > filtroAtualAgendamentos.dataFim) return false;
                if (filtroAtualAgendamentos.status !== 'todos' && a.status !== filtroAtualAgendamentos.status) return false;
                return true;
            });

            docs.forEach(a => {
                const isAgendado = a.status === 'agendado' ? 'selected' : '';
                const isConfirmado = a.status === 'confirmado' ? 'selected' : '';
                const isRealizado = a.status === 'realizado' ? 'selected' : '';
                const isCancelado = a.status === 'cancelado' ? 'selected' : '';

                tbody.innerHTML += `
                <tr>
                    <td>${formatarData(a.data)}</td>
                    <td>${a.hora}</td>
                    <td>${pacs[a.pacienteId] || '-'}</td>
                    <td>${pros[a.profissionalId] || '-'}</td>
                    <td>${sers[a.servicoId] || '-'}</td>
                    <td><span class="badge ${a.status}">${a.status}</span></td>
                    <td style="display: flex; gap: 5px; align-items: center;">
                        <select onchange="mudarStatusAgendamento('${a.id}', this.value, '${a.status}')" style="padding: 4px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px;">
                            <option value="agendado" ${isAgendado}>Agendado</option>
                            <option value="confirmado" ${isConfirmado}>Confirmado</option>
                            <option value="realizado" ${isRealizado}>Realizado</option>
                            <option value="cancelado" ${isCancelado}>Cancelado</option>
                        </select>
                        <button class="btn btn-info btn-sm" onclick="abrirModalEditar('agendamentos','${a.id}')">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="excluirItem('agendamentos','${a.id}')">🗑️</button>
                    </td>
                </tr>`;
            });
            if (docs.length === 0) tbody.innerHTML += '<tr><td colspan="7" style="text-align:center;">Nenhum agendamento encontrado.</td></tr>';
        } catch (error) { tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    window.mudarStatusAgendamento = async (id, novoStatus, statusAntigo) => {
        if (novoStatus === statusAntigo) return;
        try {
            await db.collection('agendamentos').doc(id).update({ status: novoStatus });
            registrarLog('editar', `Status de agendamento alterado para ${novoStatus}`);
            renderAgendamentos();
        } catch (error) {
            alert('Erro ao mudar o status: ' + error.message);
        }
    };

    async function preencherSelectMovimentacao() {
        const sel = $('movItem'); if (!sel) return;
        const snap = await db.collection('estoque').get(); let html = '<option value="">Selecione…</option>'; snap.forEach(doc => { html += `<option value="${doc.id}">${doc.data().nome} (Qtd: ${doc.data().quantidade})</option>`; }); sel.innerHTML = html;
    }

    async function renderMovimentacoes() {
        const tbody = $('tabelaMovimentacoes'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snap = await db.collection('movimentacoes').get();
            tbody.innerHTML = snap.empty ? '<tr><td colspan="7" style="text-align:center;">Nenhuma movimentação.</td></tr>' : '';
            const snapEst = await db.collection('estoque').get(); const itens = {}; snapEst.forEach(d => itens[d.id] = d.data().nome);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.data || '').localeCompare(a.data || ''));
            docs.forEach(m => {
                const tipoIcon = m.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída';
                tbody.innerHTML += `<tr><td>${formatarData(m.data)}</td><td>${tipoIcon}</td><td>${itens[m.itemId] || 'Item Excluído'}</td><td>${m.quantidade}</td><td>${m.motivo}</td><td>${m.usuario || '-'}</td><td><button class="btn btn-danger btn-sm" onclick="excluirItem('movimentacoes','${m.id}')">🗑️</button></td></tr>`;
            });
        } catch (error) { tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function renderHorarios() {
        const container = $('listaHorarios'); if (!container) return;
        container.innerHTML = '<p style="text-align:center;">⏳ Carregando...</p>';
        try {
            const snapPro = await db.collection('profissionais').get();
            if (snapPro.empty) { container.innerHTML = '<p>Cadastre profissionais primeiro.</p>'; return; }
            const snapHor = await db.collection('horarios').get();
            const horarios = {}; snapHor.forEach(doc => { const h = doc.data(); if (!horarios[h.profissionalId]) horarios[h.profissionalId] = []; horarios[h.profissionalId].push(h); });
            let html = '';
            snapPro.forEach(doc => {
                const pro = doc.data(); const h = horarios[doc.id] || [];
                html += `<div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                    <h4>${pro.nome} (${pro.especialidade})</h4>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;" data-prof="${doc.id}">
                        <div><label>Dia:</label><br><input type="text" class="hor-dia" value="${h[0]?.dia || ''}" placeholder="Ex: Segunda"></div>
                        <div><label>Início:</label><br><input type="time" class="hor-inicio" value="${h[0]?.inicio || ''}"></div>
                        <div><label>Fim:</label><br><input type="time" class="hor-fim" value="${h[0]?.fim || ''}"></div>
                    </div></div>`;
            });
            container.innerHTML = html;
        } catch (error) { container.innerHTML = `<p style="color:red;">Erro: ${error.message}</p>`; }
    }

    async function renderLogs() {
        const tbody = $('tabelaLogs'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snap = await db.collection('logs').get();
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.data || '').localeCompare(a.data || '')).slice(0, 100);
            if (filtroLogsAtual !== 'todos') docs = docs.filter(l => l.acao === filtroLogsAtual);
            tbody.innerHTML = docs.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Nenhum log.</td></tr>' : '';
            docs.forEach(l => {
                tbody.innerHTML += `<tr><td>${l.data}</td><td>${l.usuario}</td><td><span class="badge">${l.acao}</span></td><td>${l.detalhe}</td></tr>`;
            });
        } catch (error) { tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function preencherSelectAgendamentosPag() {
        const sel = $('pagAgendamento'); if (!sel) return;
        const snapAg = await db.collection('agendamentos').get();
        const snapPag = await db.collection('pagamentos').get();
        const pagosIds = []; snapPag.forEach(doc => pagosIds.push(doc.data().agendamentoId));
        const snapPac = await db.collection('pacientes').get(); const pacs = {}; snapPac.forEach(d => pacs[d.id] = d.data().nome);
        let html = '<option value="">Selecione…</option>';
        snapAg.forEach(doc => {
            const a = doc.data();
            if (a.status === 'realizado' && !pagosIds.includes(doc.id)) {
                html += `<option value="${doc.id}" data-valor="180.00">${formatarData(a.data)} - ${pacs[a.pacienteId] || 'Paciente'}</option>`;
            }
        });
        sel.innerHTML = html;
    }

    async function renderPagamentos() {
        const tbody = $('tabelaPagamentos'); if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">⏳ Carregando...</td></tr>';
        try {
            const snapshot = await db.collection('pagamentos').get();
            const snapAg = await db.collection('agendamentos').get(); const ags = {}; snapAg.forEach(d => ags[d.id] = d.data());
            const snapPac = await db.collection('pacientes').get(); const pacs = {}; snapPac.forEach(d => pacs[d.id] = d.data().nome);
            
            let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.data || '').localeCompare(a.data || ''));
            if (filtroPagamentoAtual !== 'todos') docs = docs.filter(p => p.status === filtroPagamentoAtual);

            tbody.innerHTML = docs.length === 0 ? '<tr><td colspan="7" style="text-align:center;">Nenhum pagamento.</td></tr>' : '';
            docs.forEach(p => {
                const ag = ags[p.agendamentoId] || {};
                tbody.innerHTML += `<tr><td>${formatarData(p.data)}</td><td>${pacs[ag.pacienteId] || '-'}</td><td>Consulta</td><td><span class="${p.status === 'pago' ? 'valor-destaque' : 'valor-pendente'}">${formatarMoeda(p.valor)}</span></td><td>${p.forma}</td><td><span class="badge ${p.status}">${p.status}</span></td><td><button class="btn btn-danger btn-sm" onclick="excluirItem('pagamentos','${p.id}')">🗑️</button></td></tr>`;
            });
            atualizarResumoFinanceiro();
        } catch (error) { tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro: ${error.message}</td></tr>`; }
    }

    async function atualizarResumoFinanceiro() {
        const snap = await db.collection('pagamentos').get();
        let fatMes = 0, fatHoje = 0, pendente = 0, ticket = 0, totalPagos = 0;
        const hoje = hojeStr();
        snap.forEach(doc => {
            const p = doc.data();
            if (p.status === 'pago') { fatMes += Number(p.valor); totalPagos++; if (p.data === hoje) fatHoje += Number(p.valor); }
            else { pendente += Number(p.valor); }
        });
        if (totalPagos > 0) ticket = fatMes / totalPagos;
        if ($('finFaturamentoMes')) $('finFaturamentoMes').textContent = formatarMoeda(fatMes);
        if ($('finFaturamentoHoje')) $('finFaturamentoHoje').textContent = formatarMoeda(fatHoje);
        if ($('finPendente')) $('finPendente').textContent = formatarMoeda(pendente);
        if ($('finTicket')) $('finTicket').textContent = formatarMoeda(ticket);
    }

    async function renderDashboard() {
        const hoje = hojeStr();
        const snapAgHoje = await db.collection('agendamentos').get();
        const snapPac = await db.collection('pacientes').get();
        const snapEst = await db.collection('estoque').get();
        const snapPag = await db.collection('pagamentos').get();
        const snapMov = await db.collection('movimentacoes').get();

        let agHojeCount = 0; snapAgHoje.forEach(doc => { if (doc.data().data === hoje) agHojeCount++; });
        let estoqueBaixo = 0; snapEst.forEach(doc => { if (Number(doc.data().quantidade) <= Number(doc.data().minimo)) estoqueBaixo++; });
        let fatMes = 0, aReceber = 0; snapPag.forEach(doc => { const p = doc.data(); if (p.status === 'pago') fatMes += Number(p.valor); else aReceber += Number(p.valor); });
        let movHoje = 0; snapMov.forEach(doc => { if (doc.data().data === hoje) movHoje++; });

        if ($('statAgendamentos')) $('statAgendamentos').textContent = agHojeCount;
        if ($('statPacientes')) $('statPacientes').textContent = snapPac.size;
        if ($('statEstoqueBaixo')) $('statEstoqueBaixo').textContent = estoqueBaixo;
        if ($('statFaturamentoMes')) $('statFaturamentoMes').textContent = formatarMoeda(fatMes);
        if ($('statAReceber')) $('statAReceber').textContent = formatarMoeda(aReceber);
        if ($('statMovHoje')) $('statMovHoje').textContent = movHoje;

        const tbodyProx = $('tabelaProximos');
        if (tbodyProx) {
            const snapAg = await db.collection('agendamentos').get();
            const pacs = {}; snapPac.forEach(d => pacs[d.id] = d.data().nome);
            const snapPro = await db.collection('profissionais').get(); const pros = {}; snapPro.forEach(d => pros[d.id] = d.data().nome);
            const snapSer = await db.collection('servicos').get(); const sers = {}; snapSer.forEach(d => sers[d.id] = d.data().nome);

            tbodyProx.innerHTML = '';
            let todos = snapAg.docs.map(d => ({ id: d.id, ...d.data() }));
            todos = todos.filter(a => a.data >= hoje && a.status !== 'cancelado');
            todos.sort((a,b) => (a.data || '').localeCompare(b.data || ''));
            const docs = todos.slice(0, 6);

            if (docs.length === 0) {
                tbodyProx.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum agendamento futuro.</td></tr>';
            } else {
                docs.forEach(a => {
                    tbodyProx.innerHTML += `<tr><td>${formatarData(a.data)}</td><td>${a.hora}</td><td>${pacs[a.pacienteId] || '-'}</td><td>${pros[a.profissionalId] || '-'}</td><td>${sers[a.servicoId] || '-'}</td><td><span class="badge ${a.status}">${a.status}</span></td></tr>`;
                });
            }
        }
    }

    async function renderRelatorios() {
        const snapAg = await db.collection('agendamentos').get();
        const snapSer = await db.collection('servicos').get();
        const sers = {}; snapSer.forEach(d => sers[d.id] = d.data());
        
        let total = 0, realizados = 0, cancelados = 0, faturamento = 0;
        const rankServ = {};

        snapAg.forEach(doc => {
            const a = doc.data();
            total++;
            if (a.status === 'realizado') {
                realizados++;
                const s = sers[a.servicoId];
                if (s) {
                    faturamento += Number(s.preco);
                    if (!rankServ[s.nome]) rankServ[s.nome] = 0;
                    rankServ[s.nome]++;
                }
            }
            if (a.status === 'cancelado') cancelados++;
        });

        const taxa = total > 0 ? (realizados / total) * 100 : 0;
        const ticket = realizados > 0 ? faturamento / realizados : 0;

        if ($('relTotal')) $('relTotal').textContent = total;
        if ($('relRealizados')) $('relRealizados').textContent = realizados;
        if ($('relCancelados')) $('relCancelados').textContent = cancelados;
        if ($('relTaxa')) $('relTaxa').textContent = taxa.toFixed(1) + '%';
        if ($('relFaturamento')) $('relFaturamento').textContent = formatarMoeda(faturamento);
        if ($('relTicket')) $('relTicket').textContent = formatarMoeda(ticket);

        const containerRank = $('rankingServicos');
        if (containerRank) {
            const sorted = Object.entries(rankServ).sort((a,b) => b[1] - a[1]);
            containerRank.innerHTML = sorted.map(([nome, qtd]) => `<div style="display:flex; justify-content:space-between; padding: 5px 0; border-bottom: 1px solid #eee;"><span>${nome}</span> <strong>${qtd}x</strong></div>`).join('');
            if (sorted.length === 0) containerRank.innerHTML = '<p class="vazio-msg">Nenhum dado.</p>';
        }
    }

    async function atualizarNotificacoes() {
        try {
            const snapEst = await db.collection('estoque').get();
            const snapAg = await db.collection('agendamentos').get();
            let alertas = [];
            
            snapEst.forEach(doc => {
                const e = doc.data();
                if (Number(e.quantidade) <= Number(e.minimo)) alertas.push(`⚠️ Estoque baixo: ${e.nome} (${e.quantidade} un)`);
                if (e.validade) {
                    const dias = Math.ceil((new Date(e.validade) - new Date()) / (1000 * 60 * 60 * 24));
                    if (dias <= 30 && dias >= 0) alertas.push(`⏰ Vencendo em ${dias}d: ${e.nome}`);
                    if (dias < 0) alertas.push(`🚫 VENCIDO: ${e.nome}`);
                }
            });

            const hoje = hojeStr();
            snapAg.forEach(doc => {
                const a = doc.data();
                if (a.data === hoje && a.status === 'agendado') alertas.push(`📅 Agendamento hoje às ${a.hora}`);
            });

            if ($('notifBadge')) $('notifBadge').textContent = alertas.length;
            
            const lista = $('notifLista');
            if (lista) {
                lista.innerHTML = alertas.length === 0 ? '<p style="padding:10px; font-size:12px; color:#666;">Tudo em ordem!</p>' : alertas.map(a => `<div style="padding:10px; border-bottom:1px solid #eee; font-size:12px;">${a}</div>`).join('');
            }
        } catch (e) { console.error(e); }
    }

    // ==========================================
    // EDIÇÃO (MODAL)
    // ==========================================
    window.abrirModalEditar = async (chave, id) => {
        const modal = $('modal');
        const titulo = $('modalTitulo');
        const conteudo = $('modalConteudo');
        
        if (!modal || !titulo || !conteudo) return alert('Modal não encontrado no HTML.');

        try {
            const doc = await db.collection(chave).doc(id).get();
            if (!doc.exists) return alert('Registro não encontrado.');
            const dados = doc.data();

            titulo.textContent = `Editar ${chave.charAt(0).toUpperCase() + chave.slice(1)}`;
            let html = '';

            if (chave === 'pacientes') {
                html = `<div class="form-grid">
                    <div class="full"><label>Nome</label><input type="text" id="edit_nome" value="${dados.nome || ''}"></div>
                    <div><label>CPF</label><input type="text" id="edit_cpf" value="${dados.cpf || ''}"></div>
                    <div><label>Telefone</label><input type="text" id="edit_telefone" value="${dados.telefone || ''}"></div>
                    <div><label>E-mail</label><input type="email" id="edit_email" value="${dados.email || ''}"></div>
                    <div><label>Nascimento</label><input type="date" id="edit_nascimento" value="${dados.nascimento || ''}"></div>
                    <div class="full"><label>Endereço</label><input type="text" id="edit_endereco" value="${dados.endereco || ''}"></div>
                </div>`;
            } else if (chave === 'profissionais') {
                html = `<div class="form-grid">
                    <div class="full"><label>Nome</label><input type="text" id="edit_nome" value="${dados.nome || ''}"></div>
                    <div class="full"><label>Especialidade</label><input type="text" id="edit_especialidade" value="${dados.especialidade || ''}"></div>
                    <div><label>Telefone</label><input type="text" id="edit_telefone" value="${dados.telefone || ''}"></div>
                    <div><label>E-mail</label><input type="email" id="edit_email" value="${dados.email || ''}"></div>
                </div>`;
            } else if (chave === 'servicos') {
                html = `<div class="form-grid">
                    <div class="full"><label>Nome</label><input type="text" id="edit_nome" value="${dados.nome || ''}"></div>
                    <div><label>Preço</label><input type="number" step="0.01" id="edit_preco" value="${dados.preco || ''}"></div>
                    <div><label>Duração (min)</label><input type="number" id="edit_duracao" value="${dados.duracao || ''}"></div>
                    <div class="full"><label>Descrição</label><input type="text" id="edit_descricao" value="${dados.descricao || ''}"></div>
                </div>`;
            } else if (chave === 'estoque') {
                html = `<div class="form-grid">
                    <div class="full"><label>Nome</label><input type="text" id="edit_nome" value="${dados.nome || ''}"></div>
                    <div><label>Categoria</label><input type="text" id="edit_categoria" value="${dados.categoria || ''}"></div>
                    <div><label>Quantidade</label><input type="number" id="edit_quantidade" value="${dados.quantidade || 0}"></div>
                    <div><label>Mínimo</label><input type="number" id="edit_minimo" value="${dados.minimo || 0}"></div>
                    <div><label>Preço</label><input type="number" step="0.01" id="edit_preco" value="${dados.preco || 0}"></div>
                    <div><label>Validade</label><input type="date" id="edit_validade" value="${dados.validade || ''}"></div>
                </div>`;
            } else if (chave === 'fornecedores') {
                html = `<div class="form-grid">
                    <div class="full"><label>Nome</label><input type="text" id="edit_nome" value="${dados.nome || ''}"></div>
                    <div><label>CNPJ</label><input type="text" id="edit_cnpj" value="${dados.cnpj || ''}"></div>
                    <div><label>Contato</label><input type="text" id="edit_contato" value="${dados.contato || ''}"></div>
                    <div><label>Telefone</label><input type="text" id="edit_telefone" value="${dados.telefone || ''}"></div>
                    <div><label>E-mail</label><input type="email" id="edit_email" value="${dados.email || ''}"></div>
                </div>`;
            } else if (chave === 'agendamentos') {
                const snapPac = await db.collection('pacientes').get();
                let optPac = ''; snapPac.forEach(d => { optPac += `<option value="${d.id}" ${d.id === dados.pacienteId ? 'selected' : ''}>${d.data().nome}</option>`; });
                const snapPro = await db.collection('profissionais').get();
                let optPro = ''; snapPro.forEach(d => { optPro += `<option value="${d.id}" ${d.id === dados.profissionalId ? 'selected' : ''}>${d.data().nome}</option>`; });
                const snapSer = await db.collection('servicos').get();
                let optSer = ''; snapSer.forEach(d => { optSer += `<option value="${d.id}" ${d.id === dados.servicoId ? 'selected' : ''}>${d.data().nome}</option>`; });

                html = `<div class="form-grid">
                    <div class="full"><label>Paciente</label><select id="edit_ag_pac">${optPac}</select></div>
                    <div class="full"><label>Profissional</label><select id="edit_ag_pro">${optPro}</select></div>
                    <div class="full"><label>Serviço</label><select id="edit_ag_ser">${optSer}</select></div>
                    <div><label>Data</label><input type="date" id="edit_ag_data" value="${dados.data || ''}"></div>
                    <div><label>Hora</label><input type="time" id="edit_ag_hora" value="${dados.hora || ''}"></div>
                    <div><label>Status</label><select id="edit_ag_status">
                        <option value="agendado" ${dados.status === 'agendado' ? 'selected' : ''}>Agendado</option>
                        <option value="confirmado" ${dados.status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                        <option value="realizado" ${dados.status === 'realizado' ? 'selected' : ''}>Realizado</option>
                        <option value="cancelado" ${dados.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select></div>
                </div>`;
            }

            conteudo.innerHTML = html;
            modal.classList.add('ativo');

            $('modalSalvar').onclick = async () => {
                const btn = $('modalSalvar');
                btn.disabled = true; btn.textContent = 'Salvando...';
                
                let dadosAtualizados = {};
                if (chave === 'pacientes') {
                    dadosAtualizados = { nome: $('edit_nome').value, cpf: $('edit_cpf').value, telefone: $('edit_telefone').value, email: $('edit_email').value, nascimento: $('edit_nascimento').value, endereco: $('edit_endereco').value };
                } else if (chave === 'profissionais') {
                    dadosAtualizados = { nome: $('edit_nome').value, especialidade: $('edit_especialidade').value, telefone: $('edit_telefone').value, email: $('edit_email').value };
                } else if (chave === 'servicos') {
                    dadosAtualizados = { nome: $('edit_nome').value, preco: parseFloat($('edit_preco').value), duracao: parseInt($('edit_duracao').value), descricao: $('edit_descricao').value };
                } else if (chave === 'estoque') {
                    dadosAtualizados = { nome: $('edit_nome').value, categoria: $('edit_categoria').value, quantidade: parseInt($('edit_quantidade').value), minimo: parseInt($('edit_minimo').value), preco: parseFloat($('edit_preco').value), validade: $('edit_validade').value };
                } else if (chave === 'fornecedores') {
                    dadosAtualizados = { nome: $('edit_nome').value, cnpj: $('edit_cnpj').value, contato: $('edit_contato').value, telefone: $('edit_telefone').value, email: $('edit_email').value };
                } else if (chave === 'agendamentos') {
                    dadosAtualizados = { 
                        pacienteId: $('edit_ag_pac').value, profissionalId: $('edit_ag_pro').value, servicoId: $('edit_ag_ser').value, 
                        data: $('edit_ag_data').value, hora: $('edit_ag_hora').value, status: $('edit_ag_status').value 
                    };
                }

                try {
                    await db.collection(chave).doc(id).update(dadosAtualizados);
                    registrarLog('editar', `Item de ${chave} editado`);
                    modal.classList.remove('ativo');
                    atualizarTudo();
                } catch (error) { alert('Erro ao salvar: ' + error.message); }
                finally { btn.disabled = false; btn.textContent = 'Salvar'; }
            };

        } catch (e) { alert('Erro: ' + e.message); }
    };

    $('modalCancelar')?.addEventListener('click', () => { $('modal').classList.remove('ativo'); });

    // ==========================================
    // PERMISSÕES E FILTROS
    // ==========================================
    function aplicarPermissoes() {
        const sessao = JSON.parse(localStorage.getItem('sessao'));
        const usuarios = carregar('usuarios');
        const user = usuarios.find(u => u.id === sessao?.usuarioId);
        if (!user) return;
        if ($('nomeUsuario')) $('nomeUsuario').textContent = user.nome;
        if ($('perfilUsuario')) $('perfilUsuario').textContent = user.perfil;
        if ($('avatar')) $('avatar').textContent = user.nome.charAt(0).toUpperCase();
        if (user.perfil !== 'admin') {
            document.querySelectorAll('[data-perm="usuarios"], [data-perm="relatorios"], [data-perm="config"]').forEach(el => el.style.display = 'none');
        }
    }

    $('filtroPaciente')?.addEventListener('input', (e) => { filtroAtualAgendamentos.paciente = e.target.value; renderAgendamentos(); });
    $('filtroDataInicio')?.addEventListener('change', (e) => { filtroAtualAgendamentos.dataInicio = e.target.value; renderAgendamentos(); });
    $('filtroDataFim')?.addEventListener('change', (e) => { filtroAtualAgendamentos.dataFim = e.target.value; renderAgendamentos(); });
    $('filtroStatus')?.addEventListener('change', (e) => { filtroAtualAgendamentos.status = e.target.value; renderAgendamentos(); });
    
    window.limparFiltrosAgendamentos = () => {
        filtroAtualAgendamentos = { paciente: '', dataInicio: '', dataFim: '', status: 'todos' };
        if ($('filtroPaciente')) $('filtroPaciente').value = '';
        if ($('filtroDataInicio')) $('filtroDataInicio').value = '';
        if ($('filtroDataFim')) $('filtroDataFim').value = '';
        if ($('filtroStatus')) $('filtroStatus').value = 'todos';
        renderAgendamentos();
    };

    document.querySelectorAll('.filtro-estoque').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-estoque').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo'); filtroEstoqueAtual = btn.dataset.filtro; renderEstoque();
        });
    });

    document.querySelectorAll('.filtro-pag').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-pag').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo'); filtroPagamentoAtual = btn.dataset.filtro; renderPagamentos();
        });
    });

    document.querySelectorAll('.filtro-logs').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-logs').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo'); filtroLogsAtual = btn.dataset.filtro; renderLogs();
        });
    });

    $('btnNotif')?.addEventListener('click', () => { $('notifPainel').classList.toggle('aberto'); });
    $('btnMarcarLidas')?.addEventListener('click', () => { $('notifBadge').textContent = '0'; $('notifPainel').classList.remove('aberto'); });
    $('bannerFechar')?.addEventListener('click', () => { $('bannerNotif').style.display = 'none'; });

    window.exportarCSV = (tipo) => { alert('Função de exportar CSV será implementada aqui.'); };

    // ==========================================
    // FORMULÁRIOS (SALVAR)
    // ==========================================
    $('formProfissional')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; try { await db.collection('profissionais').add({ nome: $('proNome').value, especialidade: $('proEspecialidade').value, telefone: $('proTelefone').value, email: $('proEmail').value }); registrarLog('criar', `Profissional cadastrado`); e.target.reset(); renderProfissionais(); } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } });
    $('formServico')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; try { await db.collection('servicos').add({ nome: $('serNome').value, preco: parseFloat($('serPreco').value), duracao: parseInt($('serDuracao').value), descricao: $('serDescricao').value }); registrarLog('criar', `Serviço cadastrado`); e.target.reset(); renderServicos(); } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } });
    $('formPaciente')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; try { await db.collection('pacientes').add({ nome: $('pacNome').value, cpf: $('pacCpf').value, telefone: $('pacTelefone').value, email: $('pacEmail').value, nascimento: $('pacNascimento').value || null, endereco: $('pacEndereco').value }); registrarLog('criar', `Paciente cadastrado`); e.target.reset(); renderPacientes(); } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } });
    $('formAgendamento')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; try { await db.collection('agendamentos').add({ pacienteId: $('agPaciente').value, profissionalId: $('agProfissional').value, servicoId: $('agServico').value, data: $('agData').value, hora: $('agHora').value, status: $('agStatus').value, obs: $('agObs').value }); registrarLog('criar', 'Novo agendamento'); e.target.reset(); renderAgendamentos(); } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } });
    $('formEstoque')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; try { await db.collection('estoque').add({ nome: $('estNome').value, categoria: $('estCategoria').value, quantidade: parseInt($('estQtd').value), minimo: parseInt($('estMin').value) || 5, preco: parseFloat($('estPreco').value) || 0, validade: $('estValidade').value, fornecedor: $('estFornecedor').value }); registrarLog('criar', `Item no estoque`); e.target.reset(); $('estMin').value = 5; renderEstoque(); } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } });
    $('formFornecedor')?.addEventListener('submit', async (e) => { e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; try { await db.collection('fornecedores').add({ nome: $('forNome').value, cnpj: $('forCnpj').value, contato: $('forContato').value, telefone: $('forTelefone').value, email: $('forEmail').value }); registrarLog('criar', `Fornecedor cadastrado`); e.target.reset(); renderFornecedores(); } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } });
    
    $('formPagamento')?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const agendamentoId = $('pagAgendamento').value;
        if (!agendamentoId) return alert('Selecione um agendamento.');
        const btn = e.target.querySelector('button'); btn.disabled = true; 
        try { 
            await db.collection('pagamentos').add({ agendamentoId: agendamentoId, valor: parseFloat($('pagValor').value), forma: $('pagForma').value, status: $('pagStatus').value, data: $('pagData').value || hojeStr(), obs: $('pagObs').value }); 
            registrarLog('criar', `Pagamento registrado`); 
            e.target.reset(); $('pagData').value = hojeStr(); renderPagamentos(); preencherSelectAgendamentosPag(); 
        } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } 
    });

    $('formMovimentacao')?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const btn = e.target.querySelector('button'); btn.disabled = true; 
        const itemId = $('movItem').value; const tipo = $('movTipo').value; const qtd = parseInt($('movQtd').value);
        if (!itemId || !qtd || qtd <= 0) { alert('Preencha os dados corretamente.'); btn.disabled = false; return; }
        try { 
            const itemRef = db.collection('estoque').doc(itemId);
            const itemDoc = await itemRef.get();
            if (!itemDoc.exists) throw new Error('Item não encontrado.');
            let novaQtd = Number(itemDoc.data().quantidade);
            if (tipo === 'entrada') { novaQtd += qtd; } 
            else { if (novaQtd < qtd) throw new Error('Quantidade insuficiente.'); novaQtd -= qtd; }
            await itemRef.update({ quantidade: novaQtd });
            const sessao = JSON.parse(localStorage.getItem('sessao'));
            const user = carregar('usuarios').find(u => u.id === sessao?.usuarioId) || { nome: 'Desconhecido' };
            await db.collection('movimentacoes').add({ itemId: itemId, tipo: tipo, quantidade: qtd, motivo: $('movMotivo').value, obs: $('movObs').value, data: hojeStr(), usuario: user.nome });
            registrarLog('criar', `Movimentação de ${tipo}`);
            e.target.reset(); renderMovimentacoes(); renderEstoque(); preencherSelectMovimentacao();
        } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; } 
    });

    $('btnSalvarHorarios')?.addEventListener('click', async () => {
        const btn = $('btnSalvarHorarios'); btn.disabled = true; btn.textContent = '⏳ Salvando...';
        try {
            const blocos = document.querySelectorAll('#listaHorarios [data-prof]');
            for (const bloco of blocos) {
                const proId = bloco.dataset.prof;
                const dia = bloco.querySelector('.hor-dia').value;
                const inicio = bloco.querySelector('.hor-inicio').value;
                const fim = bloco.querySelector('.hor-fim').value;
                const snapOld = await db.collection('horarios').where('profissionalId', '==', proId).get();
                snapOld.forEach(async d => await d.ref.delete());
                if (dia && inicio && fim) await db.collection('horarios').add({ profissionalId: proId, dia, inicio, fim });
            }
            registrarLog('editar', 'Horários atualizados');
            alert('Horários salvos!');
        } catch (error) { alert('Erro: ' + error.message); } finally { btn.disabled = false; btn.textContent = '💾 Salvar Horários'; }
    });

    $('btnLimparLogs')?.addEventListener('click', async () => {
        if (!confirm('Apagar TODOS os logs?')) return;
        try {
            const snap = await db.collection('logs').get();
            const batch = db.batch(); snap.forEach(doc => batch.delete(doc.ref));
            await batch.commit(); renderLogs();
        } catch (error) { alert('Erro: ' + error.message); }
    });

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'pagAgendamento') {
            const opt = e.target.options[e.target.selectedIndex];
            if (opt.value && $('pagValor')) $('pagValor').value = opt.dataset.valor || '180.00';
        }
    });

    window.excluirItem = async (chave, id) => {
        if (!confirm('Tem certeza que deseja excluir?')) return;
        try {
            if (['estoque', 'pacientes', 'agendamentos', 'pagamentos', 'fornecedores', 'profissionais', 'servicos', 'movimentacoes'].includes(chave)) {
                await db.collection(chave).doc(id).delete();
                registrarLog('excluir', `Item excluído`);
            } else {
                let lista = carregar(chave); lista = lista.filter(x => x.id !== id); salvar(chave, lista);
            }
            atualizarTudo();
        } catch (error) { alert('Erro ao excluir: ' + error.message); }
    };

    function atualizarTudo() {
        aplicarPermissoes();
        preencherSelectsAgendamento(); preencherSelectAgendamentosPag(); preencherSelectMovimentacao();
        renderPacientes(); renderAgendamentos(); renderEstoque(); renderFornecedores();
        renderPagamentos(); renderProfissionais(); renderServicos(); renderMovimentacoes();
        renderHorarios(); renderLogs(); renderDashboard(); renderRelatorios(); atualizarNotificacoes();
    }

    if ($('pagData')) $('pagData').value = hojeStr();
    atualizarTudo();
})();