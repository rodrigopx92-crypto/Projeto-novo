/* =========================================================
   CONFIG
   ========================================================= */
const TEMPO_SESSAO_NORMAL = 1000 * 60 * 60 * 4;
const TEMPO_SESSAO_LEMBRAR = 1000 * 60 * 60 * 24 * 30;

/* =========================================================
   VERSÃO DO APP E DO SEED
   - APP_VERSAO:  aparece no rodapé. Mude a cada atualização.
   - SEED_VERSAO: incremente quando mudar o seed.
                  Isso força todos os navegadores a recriar.
   ========================================================= */
const APP_VERSAO = 'v2.1';
const SEED_VERSAO = 3;

(function verificarVersaoSeed() {
    const versaoAtual = parseInt(localStorage.getItem('seed_versao') || '0');
    if (versaoAtual < SEED_VERSAO) {
        const chaves = ['usuarios','profissionais','servicos','pacientes','estoque','fornecedores','agendamentos','horarios','movimentacoes','pagamentos','logs','sessao'];
        chaves.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
        localStorage.setItem('seed_versao', SEED_VERSAO);
        console.log(`🔄 Seed atualizado de v${versaoAtual} para v${SEED_VERSAO} — dados serão recriados.`);
    }
})();

/* =========================================================
   HELPERS
   ========================================================= */
const $ = (id) => document.getElementById(id);
const gerarId = () => Date.now() + Math.random().toString(36).slice(2, 7);
function carregar(chave) { return JSON.parse(localStorage.getItem(chave)) || []; }
function salvar(chave, dados) { localStorage.setItem(chave, JSON.stringify(dados)); }
function formatarMoeda(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }
function formatarData(iso) {
    if (!iso) return '—';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
}
function hojeStr() { return new Date().toISOString().split('T')[0]; }
function mesStr() { return new Date().toISOString().slice(0, 7); }
function agora() {
    const d = new Date();
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}
function diasAteVencer(validade) {
    if (!validade) return null;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = new Date(validade + 'T00:00:00');
    return Math.ceil((venc - hoje) / (1000*60*60*24));
}
const FORMAS_PAG = {
    dinheiro: { nome: 'Dinheiro', emoji: '💵' },
    pix:      { nome: 'PIX', emoji: '⚡' },
    debito:   { nome: 'Débito', emoji: '💳' },
    credito:  { nome: 'Crédito', emoji: '💳' },
    convenio: { nome: 'Convênio', emoji: '🏥' },
    boleto:   { nome: 'Boleto', emoji: '📄' }
};

/* =========================================================
   SEGURANÇA
   ========================================================= */
function gerarSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function hashSenha(senha, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(senha), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function criarUsuario(nome, email, senha, perfil) {
    const salt = gerarSalt();
    const senhaHash = await hashSenha(senha, salt);
    return { id: gerarId(), nome, email: email.toLowerCase().trim(), senhaHash, salt, perfil, ativo: true, criado_em: hojeStr() };
}
async function verificarSenha(senha, usuario) {
    const hash = await hashSenha(senha, usuario.salt);
    return hash === usuario.senhaHash;
}

/* =========================================================
   PERMISSÕES
   ========================================================= */
const PERMISSOES = {
    admin: ['dashboard','agendamentos','pacientes','profissionais','servicos','estoque','fornecedores','financeiro','config','usuarios','logs','relatorios'],
    recepcao: ['dashboard','agendamentos','pacientes','profissionais','servicos','estoque','fornecedores','financeiro','relatorios'],
    profissional: ['dashboard','agendamentos','pacientes','servicos','relatorios']
};
function usuarioAtual() {
    const s = JSON.parse(localStorage.getItem('sessao'));
    if (!s || !s.logado) return null;
    return carregar('usuarios').find(u => u.id === s.usuarioId) || null;
}
function temPermissao(modulo) {
    const u = usuarioAtual();
    if (!u) return false;
    return (PERMISSOES[u.perfil] || []).includes(modulo);
}

/* =========================================================
   LOG
   ========================================================= */
function registrarLog(acao, detalhe) {
    const u = usuarioAtual();
    if (!u) return;
    const logs = carregar('logs');
    logs.push({ id: gerarId(), data: agora(), usuario: u.nome, email: u.email, acao, detalhe });
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    salvar('logs', logs);
}

/* =========================================================
   SEED (com dados históricos + hoje + futuros)
   ========================================================= */
async function popularSeVazio() {
    if (carregar('pacientes').length > 0) return false;

    const dataOffset = (d) => {
        const x = new Date(); x.setDate(x.getDate() + d);
        return x.toISOString().split('T')[0];
    };

    let seedGlobal = 42;
    function rand() {
        seedGlobal = (seedGlobal * 9301 + 49297) % 233280;
        return seedGlobal / 233280;
    }
    const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
    const randPick = (arr) => arr[randInt(0, arr.length - 1)];

    /* USUÁRIOS */
    const usuarios = [
        await criarUsuario('Administrador', 'admin@clinica.com', 'admin123', 'admin'),
        await criarUsuario('Recepção Clínica', 'recepcao@clinica.com', 'recepcao123', 'recepcao'),
        await criarUsuario('Dra. Ana Souza', 'ana.souza@clinica.com', 'prof123', 'profissional')
    ];
    salvar('usuarios', usuarios);

    /* PROFISSIONAIS */
    const profissionais = [
        { id: 'pro01', nome: 'Dra. Ana Souza',      especialidade: 'Clínica Geral', telefone: '(11) 98765-1001', email: 'ana.souza@clinica.com' },
        { id: 'pro02', nome: 'Dr. Carlos Mendes',   especialidade: 'Cardiologia',   telefone: '(11) 98765-1002', email: 'carlos.mendes@clinica.com' },
        { id: 'pro03', nome: 'Dra. Juliana Lima',   especialidade: 'Dermatologia',  telefone: '(11) 98765-1003', email: 'juliana.lima@clinica.com' },
        { id: 'pro04', nome: 'Dr. Rafael Alves',    especialidade: 'Ortopedia',     telefone: '(11) 98765-1004', email: 'rafael.alves@clinica.com' },
        { id: 'pro05', nome: 'Dra. Mariana Costa',  especialidade: 'Pediatria',     telefone: '(11) 98765-1005', email: 'mariana.costa@clinica.com' },
        { id: 'pro06', nome: 'Dr. Bruno Ferreira',  especialidade: 'Odontologia',   telefone: '(11) 98765-1006', email: 'bruno.ferreira@clinica.com' }
    ];

    /* SERVIÇOS */
    const servicos = [
        { id: 'ser01', nome: 'Consulta Clínica Geral',  preco: 180.00, duracao: 30, descricao: 'Consulta médica geral' },
        { id: 'ser02', nome: 'Consulta Cardiologia',    preco: 350.00, duracao: 45, descricao: 'Avaliação cardiológica' },
        { id: 'ser03', nome: 'Consulta Dermatologia',   preco: 300.00, duracao: 30, descricao: 'Avaliação de pele' },
        { id: 'ser04', nome: 'Consulta Ortopedia',      preco: 320.00, duracao: 40, descricao: 'Avaliação ortopédica' },
        { id: 'ser05', nome: 'Consulta Pediatria',      preco: 250.00, duracao: 30, descricao: 'Acompanhamento infantil' },
        { id: 'ser06', nome: 'Limpeza Dental',          preco: 200.00, duracao: 40, descricao: 'Profilaxia' },
        { id: 'ser07', nome: 'Restauração Dentária',    preco: 450.00, duracao: 60, descricao: 'Restauração em resina' },
        { id: 'ser08', nome: 'Eletrocardiograma (ECG)', preco: 150.00, duracao: 20, descricao: 'Exame de ritmo cardíaco' },
        { id: 'ser09', nome: 'Exame Dermatológico',     preco: 220.00, duracao: 30, descricao: 'Dermatoscopia' },
        { id: 'ser10', nome: 'Aplicação de Botox',      preco: 800.00, duracao: 60, descricao: 'Procedimento estético' }
    ];

    /* PACIENTES (15 base + 25 gerados = 40) */
    const pacientes = [
        { id: 'pac01', nome: 'João Pedro Silva',        cpf: '123.456.789-01', telefone: '(11) 91111-0001', email: 'joao.silva@email.com',     nascimento: '1985-03-12', endereco: 'Rua das Flores, 123 - SP' },
        { id: 'pac02', nome: 'Maria Fernanda Santos',   cpf: '123.456.789-02', telefone: '(11) 91111-0002', email: 'maria.santos@email.com',   nascimento: '1992-07-25', endereco: 'Av. Paulista, 1500 - SP' },
        { id: 'pac03', nome: 'Carlos Eduardo Oliveira', cpf: '123.456.789-03', telefone: '(11) 91111-0003', email: 'carlos.oliveira@email.com', nascimento: '1978-11-03', endereco: 'Rua Augusta, 500 - SP' },
        { id: 'pac04', nome: 'Ana Beatriz Rodrigues',   cpf: '123.456.789-04', telefone: '(11) 91111-0004', email: 'ana.rodrigues@email.com',  nascimento: '2000-01-18', endereco: 'Rua Oscar Freire, 800 - SP' },
        { id: 'pac05', nome: 'Lucas Gabriel Martins',   cpf: '123.456.789-05', telefone: '(11) 91111-0005', email: 'lucas.martins@email.com',  nascimento: '1995-05-30', endereco: 'Rua Consolação, 200 - SP' },
        { id: 'pac06', nome: 'Juliana Ferreira Lima',   cpf: '123.456.789-06', telefone: '(11) 91111-0006', email: 'juliana.lima@email.com',   nascimento: '1988-09-14', endereco: 'Rua da Paz, 45 - SP' },
        { id: 'pac07', nome: 'Rafael Augusto Pereira',  cpf: '123.456.789-07', telefone: '(11) 91111-0007', email: 'rafael.pereira@email.com', nascimento: '1970-12-22', endereco: 'Av. Brasil, 3000 - SP' },
        { id: 'pac08', nome: 'Patrícia Gomes Alves',    cpf: '123.456.789-08', telefone: '(11) 91111-0008', email: 'patricia.alves@email.com', nascimento: '1983-04-09', endereco: 'Rua Vergueiro, 1000 - SP' },
        { id: 'pac09', nome: 'Thiago Henrique Rocha',   cpf: '123.456.789-09', telefone: '(11) 91111-0009', email: 'thiago.rocha@email.com',   nascimento: '1998-08-16', endereco: 'Rua Ipiranga, 500 - SP' },
        { id: 'pac10', nome: 'Camila Souza Ribeiro',    cpf: '123.456.789-10', telefone: '(11) 91111-0010', email: 'camila.ribeiro@email.com', nascimento: '1990-02-28', endereco: 'Rua 7 de Abril, 200 - SP' },
        { id: 'pac11', nome: 'Fernando Dias Cardoso',   cpf: '123.456.789-11', telefone: '(11) 91111-0011', email: 'fernando.cardoso@email.com', nascimento: '1975-06-11', endereco: 'Av. Faria Lima, 4000 - SP' },
        { id: 'pac12', nome: 'Larissa Mendes Barros',   cpf: '123.456.789-12', telefone: '(11) 91111-0012', email: 'larissa.barros@email.com', nascimento: '2002-10-05', endereco: 'Rua Cardeal Arcoverde, 700 - SP' },
        { id: 'pac13', nome: 'Gustavo Nunes Teixeira',  cpf: '123.456.789-13', telefone: '(11) 91111-0013', email: 'gustavo.teixeira@email.com', nascimento: '1968-03-19', endereco: 'Rua Teodoro Sampaio, 1200 - SP' },
        { id: 'pac14', nome: 'Bianca Cristina Moraes',  cpf: '123.456.789-14', telefone: '(11) 91111-0014', email: 'bianca.moraes@email.com',  nascimento: '1993-12-01', endereco: 'Rua dos Pinheiros, 350 - SP' },
        { id: 'pac15', nome: 'Eduardo Henrique Castro', cpf: '123.456.789-15', telefone: '(11) 91111-0015', email: 'eduardo.castro@email.com', nascimento: '1980-07-27', endereco: 'Av. Rebouças, 2200 - SP' }
    ];

    const nomesM = ['Pedro','Lucas','Gabriel','Matheus','Rafael','Bruno','Felipe','Thiago','Diego','Rodrigo','André','Marcelo','Fábio','Vinícius','Leonardo'];
    const nomesF = ['Ana','Beatriz','Carla','Daniela','Eduarda','Fernanda','Gabriela','Helena','Isabela','Júlia','Larissa','Marina','Natália','Olívia','Patrícia'];
    const sobrenomes = ['Silva','Santos','Oliveira','Souza','Lima','Costa','Ferreira','Almeida','Rodrigues','Nascimento','Carvalho','Gomes','Martins','Rocha','Ribeiro'];
    const cidades = ['São Paulo','Guarulhos','Osasco','Santo André','São Bernardo','Campinas','Santos','Ribeirão Preto'];

    for (let i = 16; i <= 40; i++) {
        const isM = rand() > 0.5;
        const lista = isM ? nomesM : nomesF;
        const nome = randPick(lista) + ' ' + randPick(sobrenomes) + ' ' + randPick(sobrenomes);
        const anoNasc = randInt(1950, 2005);
        const mes = String(randInt(1, 12)).padStart(2, '0');
        const dia = String(randInt(1, 28)).padStart(2, '0');
        pacientes.push({
            id: 'pac' + String(i).padStart(2, '0'),
            nome,
            cpf: `${100 + i}.${200 + i}.${300 + i}-${String(i % 100).padStart(2, '0')}`,
            telefone: `(11) 9${String(8000 + i).slice(-4)}-${String(1000 + i).slice(-4)}`,
            email: nome.toLowerCase().replace(/\s+/g, '.') + '@email.com',
            nascimento: `${anoNasc}-${mes}-${dia}`,
            endereco: `Rua das Palmeiras, ${100 + i} - ${randPick(cidades)}/SP`
        });
    }

    /* FORNECEDORES */
    const fornecedores = [
        { id: 'for01', nome: 'MedPharma',     cnpj: '11.111.111/0001-11', contato: 'Roberto Silva', telefone: '(11) 3333-1001', email: 'vendas@medpharma.com', obs: 'Entrega em 3 dias' },
        { id: 'for02', nome: 'FarmaDist',     cnpj: '22.222.222/0001-22', contato: 'Ana Costa',     telefone: '(11) 3333-1002', email: 'comercial@farmadist.com', obs: '' },
        { id: 'for03', nome: 'CleanMed',      cnpj: '33.333.333/0001-33', contato: 'Pedro Santos',  telefone: '(11) 3333-1003', email: 'contato@cleanmed.com', obs: 'Descartáveis' },
        { id: 'for04', nome: 'Dental Supply', cnpj: '44.444.444/0001-44', contato: 'Mariana Lima',  telefone: '(11) 3333-1004', email: 'dental@dentalsupply.com', obs: 'Material odontológico' },
        { id: 'for05', nome: 'Cirúrgica BR',  cnpj: '55.555.555/0001-55', contato: 'José Alves',    telefone: '(11) 3333-1005', email: 'vendas@cirurgicabr.com', obs: '' },
        { id: 'for06', nome: 'TecMed',        cnpj: '66.666.666/0001-66', contato: 'Carla Dias',    telefone: '(11) 3333-1006', email: 'tecmed@tecmed.com', obs: 'Equipamentos' }
    ];

    /* ESTOQUE */
    const estoque = [
        { id: 'est01', nome: 'Paracetamol 500mg (cx 20)',  categoria: 'Medicamento', quantidade: 45, minimo: 20, preco: 8.50,  validade: dataOffset(250), fornecedor: 'MedPharma' },
        { id: 'est02', nome: 'Dipirona 1g (cx 10)',         categoria: 'Medicamento', quantidade: 12, minimo: 20, preco: 6.20,  validade: dataOffset(180), fornecedor: 'MedPharma' },
        { id: 'est03', nome: 'Ibuprofeno 400mg (cx 15)',    categoria: 'Medicamento', quantidade: 30, minimo: 15, preco: 12.00, validade: dataOffset(210), fornecedor: 'FarmaDist' },
        { id: 'est04', nome: 'Amoxicilina 500mg (cx 21)',   categoria: 'Antibiótico', quantidade: 8,  minimo: 10, preco: 28.90, validade: dataOffset(20),  fornecedor: 'MedPharma' },
        { id: 'est05', nome: 'Álcool 70% (500ml)',          categoria: 'Higiene',     quantidade: 60, minimo: 25, preco: 9.90,  validade: dataOffset(300), fornecedor: 'CleanMed' },
        { id: 'est06', nome: 'Luvas descartáveis (cx 100)', categoria: 'Descartável', quantidade: 22, minimo: 15, preco: 22.00, validade: dataOffset(400), fornecedor: 'CleanMed' },
        { id: 'est07', nome: 'Máscaras cirúrgicas (cx 50)', categoria: 'Descartável', quantidade: 6,  minimo: 10, preco: 18.50, validade: dataOffset(280), fornecedor: 'CleanMed' },
        { id: 'est08', nome: 'Gaze estéril (pct 10)',       categoria: 'Curativo',    quantidade: 40, minimo: 20, preco: 5.50,  validade: dataOffset(150), fornecedor: 'FarmaDist' },
        { id: 'est09', nome: 'Soro fisiológico 0,9%',       categoria: 'Medicamento', quantidade: 18, minimo: 10, preco: 7.30,  validade: dataOffset(240), fornecedor: 'MedPharma' },
        { id: 'est10', nome: 'Anestésico local (tubo)',     categoria: 'Odonto',      quantidade: 4,  minimo: 8,  preco: 45.00, validade: dataOffset(45),  fornecedor: 'Dental Supply' },
        { id: 'est11', nome: 'Resina composta A2',          categoria: 'Odonto',      quantidade: 9,  minimo: 5,  preco: 78.00, validade: dataOffset(200), fornecedor: 'Dental Supply' },
        { id: 'est12', nome: 'Lâminas de bisturi nº 15',    categoria: 'Cirúrgico',   quantidade: 25, minimo: 10, preco: 3.20,  validade: dataOffset(500), fornecedor: 'Cirúrgica BR' },
        { id: 'est13', nome: 'Termômetro digital (un)',     categoria: 'Equipamento', quantidade: 3,  minimo: 2,  preco: 55.00, validade: '',              fornecedor: 'TecMed' },
        { id: 'est14', nome: 'Compressa estéril (pct)',     categoria: 'Curativo',    quantidade: 15, minimo: 8,  preco: 6.80,  validade: dataOffset(180), fornecedor: 'FarmaDist' },
        { id: 'est15', nome: 'Álcool em gel (500ml)',       categoria: 'Higiene',     quantidade: 35, minimo: 20, preco: 14.90, validade: dataOffset(250), fornecedor: 'CleanMed' }
    ];

    /* AGENDAMENTOS */
    const agendamentos = [
        { id: 'ag01', pacienteId: 'pac01', profissionalId: 'pro01', servicoId: 'ser01', data: dataOffset(-5), hora: '09:00', status: 'realizado', obs: '' },
        { id: 'ag02', pacienteId: 'pac02', profissionalId: 'pro02', servicoId: 'ser02', data: dataOffset(-4), hora: '10:30', status: 'realizado', obs: '' },
        { id: 'ag03', pacienteId: 'pac03', profissionalId: 'pro04', servicoId: 'ser04', data: dataOffset(-4), hora: '14:00', status: 'realizado', obs: '' },
        { id: 'ag04', pacienteId: 'pac04', profissionalId: 'pro03', servicoId: 'ser03', data: dataOffset(-3), hora: '11:00', status: 'cancelado', obs: 'Desmarcou' },
        { id: 'ag05', pacienteId: 'pac05', profissionalId: 'pro06', servicoId: 'ser06', data: dataOffset(-3), hora: '15:30', status: 'realizado', obs: '' },
        { id: 'ag06', pacienteId: 'pac06', profissionalId: 'pro05', servicoId: 'ser05', data: dataOffset(-2), hora: '08:30', status: 'realizado', obs: '' },
        { id: 'ag07', pacienteId: 'pac07', profissionalId: 'pro02', servicoId: 'ser08', data: dataOffset(-1), hora: '09:15', status: 'realizado', obs: '' },
        { id: 'ag08', pacienteId: 'pac08', profissionalId: 'pro01', servicoId: 'ser01', data: dataOffset(-1), hora: '16:00', status: 'cancelado', obs: '' },
        { id: 'ag09', pacienteId: 'pac09', profissionalId: 'pro01', servicoId: 'ser01', data: dataOffset(0),  hora: '08:00', status: 'realizado', obs: '' },
        { id: 'ag10', pacienteId: 'pac10', profissionalId: 'pro03', servicoId: 'ser09', data: dataOffset(0),  hora: '09:30', status: 'confirmado', obs: '' },
        { id: 'ag11', pacienteId: 'pac11', profissionalId: 'pro02', servicoId: 'ser02', data: dataOffset(0),  hora: '11:00', status: 'confirmado', obs: 'Trazer exames' },
        { id: 'ag12', pacienteId: 'pac12', profissionalId: 'pro06', servicoId: 'ser07', data: dataOffset(0),  hora: '14:00', status: 'agendado', obs: '' },
        { id: 'ag13', pacienteId: 'pac13', profissionalId: 'pro04', servicoId: 'ser04', data: dataOffset(0),  hora: '15:30', status: 'agendado', obs: '' },
        { id: 'ag14', pacienteId: 'pac14', profissionalId: 'pro05', servicoId: 'ser05', data: dataOffset(0),  hora: '16:45', status: 'agendado', obs: '' },
        { id: 'ag15', pacienteId: 'pac15', profissionalId: 'pro01', servicoId: 'ser01', data: dataOffset(1),  hora: '08:30', status: 'confirmado', obs: '' },
        { id: 'ag16', pacienteId: 'pac01', profissionalId: 'pro03', servicoId: 'ser10', data: dataOffset(1),  hora: '10:00', status: 'agendado', obs: 'Botox' },
        { id: 'ag17', pacienteId: 'pac02', profissionalId: 'pro06', servicoId: 'ser06', data: dataOffset(2),  hora: '09:00', status: 'agendado', obs: '' },
        { id: 'ag18', pacienteId: 'pac03', profissionalId: 'pro02', servicoId: 'ser08', data: dataOffset(2),  hora: '11:30', status: 'confirmado', obs: '' },
        { id: 'ag19', pacienteId: 'pac05', profissionalId: 'pro05', servicoId: 'ser05', data: dataOffset(3),  hora: '14:00', status: 'agendado', obs: '' },
        { id: 'ag20', pacienteId: 'pac07', profissionalId: 'pro04', servicoId: 'ser04', data: dataOffset(3),  hora: '15:00', status: 'agendado', obs: '' },
        { id: 'ag21', pacienteId: 'pac09', profissionalId: 'pro01', servicoId: 'ser01', data: dataOffset(4),  hora: '08:00', status: 'agendado', obs: 'Retorno' },
        { id: 'ag22', pacienteId: 'pac11', profissionalId: 'pro03', servicoId: 'ser03', data: dataOffset(5),  hora: '10:30', status: 'agendado', obs: '' },
        { id: 'ag23', pacienteId: 'pac13', profissionalId: 'pro06', servicoId: 'ser07', data: dataOffset(6),  hora: '13:00', status: 'agendado', obs: '' },
        { id: 'ag24', pacienteId: 'pac14', profissionalId: 'pro02', servicoId: 'ser02', data: dataOffset(7),  hora: '09:45', status: 'agendado', obs: '' },
        { id: 'ag25', pacienteId: 'pac15', profissionalId: 'pro04', servicoId: 'ser04', data: dataOffset(7),  hora: '16:00', status: 'agendado', obs: '' },
        { id: 'ag26', pacienteId: 'pac01', profissionalId: 'pro02', servicoId: 'ser02', data: dataOffset(-8), hora: '10:00', status: 'realizado', obs: '' },
        { id: 'ag27', pacienteId: 'pac02', profissionalId: 'pro01', servicoId: 'ser01', data: dataOffset(-10), hora: '11:00', status: 'realizado', obs: '' },
        { id: 'ag28', pacienteId: 'pac03', profissionalId: 'pro03', servicoId: 'ser09', data: dataOffset(-12), hora: '14:00', status: 'realizado', obs: '' },
        { id: 'ag29', pacienteId: 'pac04', profissionalId: 'pro06', servicoId: 'ser07', data: dataOffset(-15), hora: '15:00', status: 'realizado', obs: '' },
        { id: 'ag30', pacienteId: 'pac05', profissionalId: 'pro04', servicoId: 'ser04', data: dataOffset(-20), hora: '09:00', status: 'realizado', obs: '' }
    ];

    const statusHistoricos = ['realizado','realizado','realizado','realizado','cancelado','realizado','realizado','realizado'];
    let idAg = 31;

    // Histórico: -180 até -1
    for (let d = -180; d <= -1; d++) {
        const diaSemana = new Date(Date.now() + d * 86400000).getDay();
        const qtdDia = diaSemana === 0 ? 0 : randInt(2, 5);
        for (let j = 0; j < qtdDia; j++) {
            const hora = String(randInt(8, 17)).padStart(2, '0') + ':00';
            const pac = randPick(pacientes);
            const pro = randPick(profissionais);
            const ser = randPick(servicos);
            const status = randPick(statusHistoricos);
            agendamentos.push({
                id: 'ag' + String(idAg++).padStart(3, '0'),
                pacienteId: pac.id, profissionalId: pro.id, servicoId: ser.id,
                data: dataOffset(d), hora, status, obs: ''
            });
        }
    }

    // HOJE: 12 a 14 agendamentos
    const qtdHoje = randInt(12, 14);
    const horasHoje = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];
    const usadas = new Set();
    for (let j = 0; j < qtdHoje; j++) {
        let hora;
        do { hora = randPick(horasHoje); } while (usadas.has(hora));
        usadas.add(hora);
        const pac = randPick(pacientes);
        const pro = randPick(profissionais);
        const ser = randPick(servicos);
        const r = rand();
        const status = r < 0.35 ? 'realizado' : r < 0.65 ? 'confirmado' : 'agendado';
        agendamentos.push({
            id: 'ag' + String(idAg++).padStart(3, '0'),
            pacienteId: pac.id, profissionalId: pro.id, servicoId: ser.id,
            data: dataOffset(0), hora, status, obs: ''
        });
    }

    // Futuros: +1 a +30 dias
    for (let d = 1; d <= 30; d++) {
        const diaSemana = new Date(Date.now() + d * 86400000).getDay();
        const qtdDia = diaSemana === 0 ? 0 : randInt(2, 5);
        for (let j = 0; j < qtdDia; j++) {
            const hora = String(randInt(8, 17)).padStart(2, '0') + ':00';
            const pac = randPick(pacientes);
            const pro = randPick(profissionais);
            const ser = randPick(servicos);
            const status = rand() > 0.5 ? 'agendado' : 'confirmado';
            agendamentos.push({
                id: 'ag' + String(idAg++).padStart(3, '0'),
                pacienteId: pac.id, profissionalId: pro.id, servicoId: ser.id,
                data: dataOffset(d), hora, status, obs: ''
            });
        }
    }

    /* HORÁRIOS */
    const horarios = [
        { dia: 0, nome: 'Domingo', aberto: false, inicio: '08:00', fim: '12:00' },
        { dia: 1, nome: 'Segunda', aberto: true,  inicio: '08:00', fim: '18:00' },
        { dia: 2, nome: 'Terça',   aberto: true,  inicio: '08:00', fim: '18:00' },
        { dia: 3, nome: 'Quarta',  aberto: true,  inicio: '08:00', fim: '18:00' },
        { dia: 4, nome: 'Quinta',  aberto: true,  inicio: '08:00', fim: '20:00' },
        { dia: 5, nome: 'Sexta',   aberto: true,  inicio: '08:00', fim: '18:00' },
        { dia: 6, nome: 'Sábado',  aberto: true,  inicio: '08:00', fim: '13:00' }
    ];

    /* MOVIMENTAÇÕES */
    const movimentacoes = [
        { id: 'mov01', itemId: 'est01', tipo: 'entrada', quantidade: 50, motivo: 'compra', data: dataOffset(-10), usuario: 'Administrador', obs: 'Pedido inicial' },
        { id: 'mov02', itemId: 'est01', tipo: 'saida',   quantidade: 5,  motivo: 'uso',    data: dataOffset(-2),  usuario: 'Administrador', obs: 'Consultas do dia' },
        { id: 'mov03', itemId: 'est02', tipo: 'saida',   quantidade: 8,  motivo: 'uso',    data: dataOffset(-1),  usuario: 'Recepção Clínica', obs: '' },
        { id: 'mov04', itemId: 'est05', tipo: 'entrada', quantidade: 60, motivo: 'compra', data: dataOffset(-7),  usuario: 'Administrador', obs: '' },
        { id: 'mov05', itemId: 'est06', tipo: 'saida',   quantidade: 3,  motivo: 'uso',    data: dataOffset(0),   usuario: 'Recepção Clínica', obs: 'Procedimentos de hoje' }
    ];
    let idMov = 6;
    for (let i = 0; i < 30; i++) {
        const item = randPick(estoque);
        const tipo = rand() > 0.6 ? 'entrada' : 'saida';
        const qtd = randInt(1, 15);
        const motivo = tipo === 'entrada'
            ? ['compra','devolucao','ajuste'][randInt(0, 2)]
            : ['uso','perda','vencimento','ajuste'][randInt(0, 3)];
        movimentacoes.push({
            id: 'mov' + String(idMov++).padStart(3, '0'),
            itemId: item.id, tipo, quantidade: qtd, motivo,
            data: dataOffset(-randInt(1, 90)),
            usuario: rand() > 0.5 ? 'Recepção Clínica' : 'Administrador',
            obs: ''
        });
    }

    /* PAGAMENTOS */
    const formas = ['dinheiro','pix','debito','credito','convenio'];
    const pagamentos = [
        { id: 'pag01', agendamentoId: 'ag01', valor: 180.00, forma: 'pix',      status: 'pago',     data: dataOffset(-5), obs: '',  usuario: 'Recepção Clínica' },
        { id: 'pag02', agendamentoId: 'ag02', valor: 350.00, forma: 'credito',  status: 'pago',     data: dataOffset(-4), obs: '',  usuario: 'Recepção Clínica' },
        { id: 'pag03', agendamentoId: 'ag03', valor: 320.00, forma: 'dinheiro', status: 'pago',     data: dataOffset(-4), obs: '',  usuario: 'Administrador' },
        { id: 'pag04', agendamentoId: 'ag05', valor: 200.00, forma: 'debito',   status: 'pago',     data: dataOffset(-3), obs: '',  usuario: 'Recepção Clínica' },
        { id: 'pag05', agendamentoId: 'ag06', valor: 250.00, forma: 'convenio', status: 'pendente', data: dataOffset(-2), obs: 'Aguardando convênio', usuario: 'Recepção Clínica' },
        { id: 'pag06', agendamentoId: 'ag07', valor: 150.00, forma: 'pix',      status: 'pago',     data: dataOffset(-1), obs: '',  usuario: 'Recepção Clínica' },
        { id: 'pag07', agendamentoId: 'ag09', valor: 180.00, forma: 'dinheiro', status: 'pago',     data: dataOffset(0),  obs: '',  usuario: 'Administrador' },
        { id: 'pag08', agendamentoId: 'ag26', valor: 350.00, forma: 'pix',      status: 'pago',     data: dataOffset(-8), obs: '',  usuario: 'Recepção Clínica' },
        { id: 'pag09', agendamentoId: 'ag27', valor: 180.00, forma: 'credito',  status: 'pendente', data: dataOffset(-10),obs: 'Cliente pediu pra cobrar depois', usuario: 'Recepção Clínica' },
        { id: 'pag10', agendamentoId: 'ag28', valor: 220.00, forma: 'pix',      status: 'pago',     data: dataOffset(-12),obs: '',  usuario: 'Recepção Clínica' }
    ];

    const jaPagos = new Set(pagamentos.map(p => p.agendamentoId));
    let idPag = 11;
    const servMap = Object.fromEntries(servicos.map(s => [s.id, s]));

    agendamentos.filter(a => a.status === 'realizado').forEach(ag => {
        if (jaPagos.has(ag.id)) return;
        if (rand() > 0.85) return;
        const serv = servMap[ag.servicoId] || { preco: 100 };
        const estaPago = rand() > 0.15;
        const forma = randPick(formas);
        pagamentos.push({
            id: 'pag' + String(idPag++).padStart(3, '0'),
            agendamentoId: ag.id, valor: serv.preco, forma,
            status: estaPago ? 'pago' : 'pendente',
            data: ag.data, obs: '',
            usuario: rand() > 0.5 ? 'Recepção Clínica' : 'Administrador'
        });
    });

    /* LOGS HISTÓRICOS */
    const acoesLog = [
        { acao: 'login',   det: (u) => `Usuário ${u} entrou no sistema` },
        { acao: 'logout',  det: (u) => `Usuário ${u} saiu do sistema` },
        { acao: 'criar',   det: ()  => `Paciente cadastrado` },
        { acao: 'criar',   det: ()  => `Agendamento criado` },
        { acao: 'criar',   det: ()  => `Pagamento registrado` },
        { acao: 'editar',  det: ()  => `Agendamento editado` },
        { acao: 'editar',  det: ()  => `Item do estoque editado` },
        { acao: 'excluir', det: ()  => `Agendamento cancelado` }
    ];
    const usuariosLista = ['Administrador','Recepção Clínica','Dra. Ana Souza'];
    const logs = [];
    for (let i = 0; i < 50; i++) {
        const a = randPick(acoesLog);
        const u = randPick(usuariosLista);
        const d = new Date(); d.setDate(d.getDate() - randInt(1, 90));
        d.setHours(randInt(8, 19), randInt(0, 59));
        logs.push({
            id: gerarId(),
            data: d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR'),
            usuario: u, email: u.toLowerCase().replace(/\s+/g, '.') + '@clinica.com',
            acao: a.acao, detalhe: a.det(u)
        });
    }

    /* SALVA TUDO */
    salvar('profissionais', profissionais);
    salvar('servicos',      servicos);
    salvar('pacientes',     pacientes);
    salvar('estoque',       estoque);
    salvar('fornecedores',  fornecedores);
    salvar('agendamentos',  agendamentos);
    salvar('horarios',      horarios);
    salvar('movimentacoes', movimentacoes);
    salvar('pagamentos',    pagamentos);
    salvar('logs',          logs);

    console.log('✅ Seed completo executado!');
    console.log(`   Pacientes: ${pacientes.length}`);
    console.log(`   Agendamentos: ${agendamentos.length}`);
    console.log(`   Pagamentos: ${pagamentos.length}`);
    return true;
}
/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
(async () => {
    await popularSeVazio();

    /* LOGIN */
    if ($('loginForm')) {
        $('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = $('usuario').value.toLowerCase().trim();
            const senha = $('senha').value;
            const lembrar = $('lembrar').checked;
            const btn = $('btnEntrar');

            btn.disabled = true;
            btn.innerHTML = '<span>Verificando...</span>';
            $('erro').style.display = 'none';

            const usuarios = carregar('usuarios');
            const user = usuarios.find(u => u.email === email && u.ativo);

            if (!user) {
                $('erro').textContent = '⚠️ E-mail ou senha inválidos!';
                $('erro').style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = '<span>Entrar no sistema</span><span class="arrow">→</span>';
                return;
            }

            const ok = await verificarSenha(senha, user);
            if (ok) {
                const tempo = lembrar ? TEMPO_SESSAO_LEMBRAR : TEMPO_SESSAO_NORMAL;
                localStorage.setItem('sessao', JSON.stringify({
                    logado: true, usuarioId: user.id, expira: Date.now() + tempo
                }));
                window.location.href = 'painel.html';
            } else {
                $('erro').textContent = '⚠️ E-mail ou senha inválidos!';
                $('erro').style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = '<span>Entrar no sistema</span><span class="arrow">→</span>';
            }
        });
        return;
    }

    /* PAINEL */
    if (!$('menu')) return;

    const sessao = JSON.parse(localStorage.getItem('sessao'));
    if (!sessao || !sessao.logado || Date.now() > sessao.expira) {
        localStorage.removeItem('sessao');
        window.location.href = 'index.html';
        return;
    }

    const user = carregar('usuarios').find(u => u.id === sessao.usuarioId && u.ativo);
    if (!user) {
        localStorage.removeItem('sessao');
        window.location.href = 'index.html';
        return;
    }

    $('nomeUsuario').textContent = user.nome;
    $('avatar').textContent = user.nome.charAt(0).toUpperCase();
    $('perfilUsuario').textContent = user.perfil;

    registrarLog('login', `Usuário ${user.nome} entrou no sistema`);

    document.querySelectorAll('#menu a[data-perm]').forEach(link => {
        if (!temPermissao(link.dataset.perm)) link.style.display = 'none';
    });

    $('btnSair').addEventListener('click', (e) => {
        e.preventDefault();
        registrarLog('logout', `Usuário ${user.nome} saiu do sistema`);
        localStorage.removeItem('sessao');
        window.location.href = 'index.html';
    });

    document.querySelectorAll('#menu a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const alvo = link.dataset.tela;
            document.querySelectorAll('#menu a').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
            $('tela-' + alvo).classList.add('ativa');
            $('tituloTela').textContent = link.querySelector('span:last-child').textContent;
            atualizarTudo();
        });
    });

    /* MODAL */
    let modalCallback = null;
    window.abrirModal = function (titulo, htmlConteudo, onSalvar) {
        $('modalTitulo').textContent = titulo;
        $('modalConteudo').innerHTML = htmlConteudo;
        modalCallback = onSalvar;
        $('modal').classList.add('ativo');
    };
    window.fecharModal = function () {
        $('modal').classList.remove('ativo');
        modalCallback = null;
    };
    $('modalCancelar').addEventListener('click', fecharModal);
    $('modalSalvar').addEventListener('click', () => { if (modalCallback) modalCallback(); });
    $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) fecharModal(); });

    /* RODAPÉ */
    function atualizarRodape() {
        const v = document.getElementById('footerVersao');
        const d = document.getElementById('footerData');
        if (v) v.textContent = APP_VERSAO;
        if (d) {
            const now = new Date();
            d.textContent = now.toLocaleDateString('pt-BR') + ' ' +
                            now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
    }

    /* PACIENTES */
    function renderPacientes() {
        const lista = carregar('pacientes');
        const tbody = $('tabelaPacientes');
        tbody.innerHTML = '';
        $('vazioPacientes').style.display = lista.length ? 'none' : 'block';
        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.nome}</td>
                <td>${p.telefone || '—'}</td>
                <td>${p.email || '—'}</td>
                <td>${formatarData(p.nascimento)}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="editarPaciente('${p.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('pacientes','${p.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    $('formPaciente').addEventListener('submit', (e) => {
        e.preventDefault();
        const lista = carregar('pacientes');
        const novo = {
            id: gerarId(), nome: $('pacNome').value, cpf: $('pacCpf').value,
            telefone: $('pacTelefone').value, email: $('pacEmail').value,
            nascimento: $('pacNascimento').value, endereco: $('pacEndereco').value
        };
        lista.push(novo);
        salvar('pacientes', lista);
        registrarLog('criar', `Paciente "${novo.nome}" cadastrado`);
        e.target.reset();
        atualizarTudo();
    });

    window.editarPaciente = (id) => {
        const lista = carregar('pacientes');
        const p = lista.find(x => x.id === id);
        abrirModal('Editar Paciente', `
            <label>Nome</label><input id="ed_nome" value="${p.nome}">
            <label>CPF</label><input id="ed_cpf" value="${p.cpf || ''}">
            <label>Telefone</label><input id="ed_tel" value="${p.telefone || ''}">
            <label>E-mail</label><input id="ed_email" value="${p.email || ''}">
            <label>Nascimento</label><input type="date" id="ed_nasc" value="${p.nascimento || ''}">
            <label>Endereço</label><input id="ed_end" value="${p.endereco || ''}">
        `, () => {
            p.nome = $('ed_nome').value; p.cpf = $('ed_cpf').value;
            p.telefone = $('ed_tel').value; p.email = $('ed_email').value;
            p.nascimento = $('ed_nasc').value; p.endereco = $('ed_end').value;
            salvar('pacientes', lista);
            registrarLog('editar', `Paciente "${p.nome}" editado`);
            fecharModal(); atualizarTudo();
        });
    };

    /* PROFISSIONAIS */
    function renderProfissionais() {
        const lista = carregar('profissionais');
        const tbody = $('tabelaProfissionais');
        tbody.innerHTML = '';
        $('vazioProfissionais').style.display = lista.length ? 'none' : 'block';
        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.nome}</td><td>${p.especialidade}</td>
                <td>${p.telefone || '—'}</td><td>${p.email || '—'}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="editarProfissional('${p.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('profissionais','${p.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    $('formProfissional').addEventListener('submit', (e) => {
        e.preventDefault();
        const lista = carregar('profissionais');
        const novo = {
            id: gerarId(), nome: $('proNome').value,
            especialidade: $('proEspecialidade').value,
            telefone: $('proTelefone').value, email: $('proEmail').value
        };
        lista.push(novo);
        salvar('profissionais', lista);
        registrarLog('criar', `Profissional "${novo.nome}" cadastrado`);
        e.target.reset();
        atualizarTudo();
    });

    window.editarProfissional = (id) => {
        const lista = carregar('profissionais');
        const p = lista.find(x => x.id === id);
        abrirModal('Editar Profissional', `
            <label>Nome</label><input id="ed_nome" value="${p.nome}">
            <label>Especialidade</label><input id="ed_esp" value="${p.especialidade}">
            <label>Telefone</label><input id="ed_tel" value="${p.telefone || ''}">
            <label>E-mail</label><input id="ed_email" value="${p.email || ''}">
        `, () => {
            p.nome = $('ed_nome').value; p.especialidade = $('ed_esp').value;
            p.telefone = $('ed_tel').value; p.email = $('ed_email').value;
            salvar('profissionais', lista);
            registrarLog('editar', `Profissional "${p.nome}" editado`);
            fecharModal(); atualizarTudo();
        });
    };

    /* SERVIÇOS */
    function renderServicos() {
        const lista = carregar('servicos');
        const tbody = $('tabelaServicos');
        tbody.innerHTML = '';
        $('vazioServicos').style.display = lista.length ? 'none' : 'block';
        lista.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.nome}</td><td>${formatarMoeda(s.preco)}</td>
                <td>${s.duracao} min</td><td>${s.descricao || '—'}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="editarServico('${s.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('servicos','${s.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    $('formServico').addEventListener('submit', (e) => {
        e.preventDefault();
        const lista = carregar('servicos');
        const novo = {
            id: gerarId(), nome: $('serNome').value,
            preco: parseFloat($('serPreco').value),
            duracao: parseInt($('serDuracao').value) || 30,
            descricao: $('serDescricao').value
        };
        lista.push(novo);
        salvar('servicos', lista);
        registrarLog('criar', `Serviço "${novo.nome}" cadastrado`);
        e.target.reset();
        $('serDuracao').value = 30;
        atualizarTudo();
    });

    window.editarServico = (id) => {
        const lista = carregar('servicos');
        const s = lista.find(x => x.id === id);
        abrirModal('Editar Serviço', `
            <label>Nome</label><input id="ed_nome" value="${s.nome}">
            <label>Preço</label><input type="number" step="0.01" id="ed_preco" value="${s.preco}">
            <label>Duração (min)</label><input type="number" id="ed_dur" value="${s.duracao}">
            <label>Descrição</label><input id="ed_desc" value="${s.descricao || ''}">
        `, () => {
            s.nome = $('ed_nome').value;
            s.preco = parseFloat($('ed_preco').value);
            s.duracao = parseInt($('ed_dur').value);
            s.descricao = $('ed_desc').value;
            salvar('servicos', lista);
            registrarLog('editar', `Serviço "${s.nome}" editado`);
            fecharModal(); atualizarTudo();
        });
    };

    /* ESTOQUE */
    let filtroEstoque = 'todos';
    document.querySelectorAll('.filtro-estoque').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-estoque').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            filtroEstoque = btn.dataset.filtro;
            renderEstoque();
        });
    });

    function statusEstoque(item) {
        const dias = diasAteVencer(item.validade);
        if (dias !== null && dias < 0) return { txt: '🚫 Vencido', cls: 'vencido' };
        if (dias !== null && dias <= 30) return { txt: `⏰ Vence em ${dias}d`, cls: 'vencendo' };
        if (item.quantidade <= item.minimo) return { txt: '⚠️ Estoque baixo', cls: 'estoque-baixo' };
        return { txt: '✔ OK', cls: 'estoque-ok' };
    }

    function renderEstoque() {
        let lista = carregar('estoque');
        if (filtroEstoque === 'baixo') lista = lista.filter(i => i.quantidade <= i.minimo);
        else if (filtroEstoque === 'vencendo') lista = lista.filter(i => { const d = diasAteVencer(i.validade); return d !== null && d >= 0 && d <= 30; });
        else if (filtroEstoque === 'vencidos') lista = lista.filter(i => { const d = diasAteVencer(i.validade); return d !== null && d < 0; });

        const tbody = $('tabelaEstoque');
        tbody.innerHTML = '';
        $('vazioEstoque').style.display = lista.length ? 'none' : 'block';

        lista.forEach(item => {
            const st = statusEstoque(item);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nome}</td>
                <td>${item.categoria || '—'}</td>
                <td>${item.quantidade}</td>
                <td>${item.minimo}</td>
                <td>${formatarData(item.validade)}</td>
                <td><span class="badge ${st.cls}">${st.txt}</span></td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="movimentarRapido('${item.id}','entrada')" title="Entrada">📥</button>
                    <button class="btn btn-warning btn-sm" onclick="movimentarRapido('${item.id}','saida')" title="Saída">📤</button>
                    <button class="btn btn-info btn-sm" onclick="editarEstoque('${item.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('estoque','${item.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });
        renderReposicao();
    }

    function renderReposicao() {
        const estoque = carregar('estoque');
        const abaixoMin = estoque.filter(i => i.quantidade <= i.minimo);
        const tbody = $('tabelaReposicao');
        tbody.innerHTML = '';
        $('vazioReposicao').style.display = abaixoMin.length ? 'none' : 'block';
        abaixoMin.forEach(item => {
            const sugestao = Math.max(item.minimo * 2 - item.quantidade, item.minimo);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nome}</td>
                <td>${item.quantidade}</td>
                <td>${item.minimo}</td>
                <td><strong>${sugestao} un.</strong></td>
                <td>${item.fornecedor || '—'}</td>`;
            tbody.appendChild(tr);
        });
    }

    window.movimentarRapido = (itemId, tipo) => {
        const item = carregar('estoque').find(i => i.id === itemId);
        abrirModal(
            `${tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'} — ${item.nome}`,
            `
            <label>Quantidade</label>
            <input type="number" id="mqtd" min="1" value="1">
            <label>Motivo</label>
            <select id="mmotivo">
                ${tipo === 'entrada'
                    ? '<option value="compra">Compra</option><option value="devolucao">Devolução</option><option value="ajuste">Ajuste</option>'
                    : '<option value="uso">Uso em procedimento</option><option value="perda">Perda/Quebra</option><option value="vencimento">Vencimento</option><option value="ajuste">Ajuste</option>'}
            </select>
            <label>Observações</label>
            <input id="mobs" placeholder="Opcional">
            `,
            () => {
                const qtd = parseInt($('mqtd').value);
                if (!qtd || qtd < 1) return alert('Quantidade inválida');
                if (tipo === 'saida' && qtd > item.quantidade) return alert('Quantidade maior que o estoque atual');

                const estoque = carregar('estoque');
                const i = estoque.find(x => x.id === itemId);
                i.quantidade += tipo === 'entrada' ? qtd : -qtd;
                salvar('estoque', estoque);

                const u = usuarioAtual();
                const mov = carregar('movimentacoes');
                mov.push({
                    id: gerarId(), itemId, tipo, quantidade: qtd,
                    motivo: $('mmotivo').value, obs: $('mobs').value,
                    data: hojeStr(), usuario: u.nome
                });
                salvar('movimentacoes', mov);
                registrarLog(tipo === 'entrada' ? 'criar' : 'excluir',
                    `${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${qtd} un. em "${item.nome}"`);
                fecharModal(); atualizarTudo();
            }
        );
    };

    $('formEstoque').addEventListener('submit', (e) => {
        e.preventDefault();
        const lista = carregar('estoque');
        const novo = {
            id: gerarId(), nome: $('estNome').value, categoria: $('estCategoria').value,
            quantidade: parseInt($('estQtd').value), minimo: parseInt($('estMin').value) || 5,
            preco: parseFloat($('estPreco').value) || 0,
            validade: $('estValidade').value, fornecedor: $('estFornecedor').value
        };
        lista.push(novo);
        salvar('estoque', lista);
        registrarLog('criar', `Item "${novo.nome}" adicionado ao estoque`);
        e.target.reset();
        $('estMin').value = 5;
        atualizarTudo();
    });

    window.editarEstoque = (id) => {
        const lista = carregar('estoque');
        const i = lista.find(x => x.id === id);
        abrirModal('Editar Item do Estoque', `
            <label>Nome</label><input id="ed_nome" value="${i.nome}">
            <label>Categoria</label><input id="ed_cat" value="${i.categoria || ''}">
            <label>Quantidade</label><input type="number" id="ed_qtd" value="${i.quantidade}">
            <label>Mínimo</label><input type="number" id="ed_min" value="${i.minimo}">
            <label>Preço</label><input type="number" step="0.01" id="ed_preco" value="${i.preco}">
            <label>Validade</label><input type="date" id="ed_val" value="${i.validade || ''}">
            <label>Fornecedor</label><input id="ed_forn" value="${i.fornecedor || ''}">
        `, () => {
            i.nome = $('ed_nome').value; i.categoria = $('ed_cat').value;
            i.quantidade = parseInt($('ed_qtd').value); i.minimo = parseInt($('ed_min').value);
            i.preco = parseFloat($('ed_preco').value) || 0;
            i.validade = $('ed_val').value; i.fornecedor = $('ed_forn').value;
            salvar('estoque', lista);
            registrarLog('editar', `Item "${i.nome}" editado`);
            fecharModal(); atualizarTudo();
        });
    };

    $('btnExportarPedido').addEventListener('click', () => {
        const estoque = carregar('estoque');
        const abaixoMin = estoque.filter(i => i.quantidade <= i.minimo);
        if (abaixoMin.length === 0) return alert('✅ Nada para repor!');
        let csv = 'Item,Estoque Atual,Mínimo,Sugestão de Compra,Fornecedor\n';
        abaixoMin.forEach(i => {
            const sugestao = Math.max(i.minimo * 2 - i.quantidade, i.minimo);
            csv += `"${i.nome}",${i.quantidade},${i.minimo},${sugestao},"${i.fornecedor || ''}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pedido-reposicao-${hojeStr()}.csv`;
        link.click();
    });

    /* MOVIMENTAÇÕES */
    function preencherSelectItens() {
        const estoque = carregar('estoque');
        $('movItem').innerHTML = '<option value="">Selecione…</option>' +
            estoque.map(i => `<option value="${i.id}">${i.nome} (${i.quantidade} un.)</option>`).join('');
    }

    function renderMovimentacoes() {
        const lista = carregar('movimentacoes');
        const estoque = carregar('estoque');
        const itemMap = Object.fromEntries(estoque.map(i => [i.id, i.nome]));
        lista.sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));

        const tbody = $('tabelaMovimentacoes');
        tbody.innerHTML = '';
        $('vazioMovimentacoes').style.display = lista.length ? 'none' : 'block';

        lista.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(m.data)}</td>
                <td><span class="badge ${m.tipo}">${m.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}</span></td>
                <td>${itemMap[m.itemId] || '—'}</td>
                <td>${m.quantidade}</td>
                <td>${m.motivo}</td>
                <td>${m.usuario || '—'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('movimentacoes','${m.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    $('formMovimentacao').addEventListener('submit', (e) => {
        e.preventDefault();
        const itemId = $('movItem').value;
        const tipo = $('movTipo').value;
        const qtd = parseInt($('movQtd').value);

        const estoque = carregar('estoque');
        const item = estoque.find(i => i.id === itemId);
        if (!item) return alert('Item não encontrado');
        if (tipo === 'saida' && qtd > item.quantidade)
            return alert(`Estoque insuficiente! Disponível: ${item.quantidade}`);

        item.quantidade += tipo === 'entrada' ? qtd : -qtd;
        salvar('estoque', estoque);

        const u = usuarioAtual();
        const mov = carregar('movimentacoes');
        mov.push({
            id: gerarId(), itemId, tipo, quantidade: qtd,
            motivo: $('movMotivo').value, obs: $('movObs').value,
            data: hojeStr(), usuario: u.nome
        });
        salvar('movimentacoes', mov);
        registrarLog(tipo === 'entrada' ? 'criar' : 'excluir',
            `${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${qtd} un. em "${item.nome}"`);
        e.target.reset();
        atualizarTudo();
    });

    /* FORNECEDORES */
    function preencherSelectFornecedores() {
        const lista = carregar('fornecedores');
        $('estFornecedor').innerHTML = '<option value="">Selecione…</option>' +
            lista.map(f => `<option value="${f.nome}">${f.nome}</option>`).join('');
    }

    function renderFornecedores() {
        const lista = carregar('fornecedores');
        const tbody = $('tabelaFornecedores');
        tbody.innerHTML = '';
        $('vazioFornecedores').style.display = lista.length ? 'none' : 'block';
        lista.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${f.nome}</td>
                <td>${f.cnpj || '—'}</td>
                <td>${f.contato || '—'}</td>
                <td>${f.telefone || '—'}</td>
                <td>${f.email || '—'}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="editarFornecedor('${f.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('fornecedores','${f.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    $('formFornecedor').addEventListener('submit', (e) => {
        e.preventDefault();
        const lista = carregar('fornecedores');
        const novo = {
            id: gerarId(), nome: $('forNome').value, cnpj: $('forCnpj').value,
            contato: $('forContato').value, telefone: $('forTelefone').value,
            email: $('forEmail').value, obs: $('forObs').value
        };
        lista.push(novo);
        salvar('fornecedores', lista);
        registrarLog('criar', `Fornecedor "${novo.nome}" cadastrado`);
        e.target.reset();
        atualizarTudo();
    });

    window.editarFornecedor = (id) => {
        const lista = carregar('fornecedores');
        const f = lista.find(x => x.id === id);
        abrirModal('Editar Fornecedor', `
            <label>Nome</label><input id="ed_nome" value="${f.nome}">
            <label>CNPJ</label><input id="ed_cnpj" value="${f.cnpj || ''}">
            <label>Contato</label><input id="ed_contato" value="${f.contato || ''}">
            <label>Telefone</label><input id="ed_tel" value="${f.telefone || ''}">
            <label>E-mail</label><input id="ed_email" value="${f.email || ''}">
            <label>Observações</label><input id="ed_obs" value="${f.obs || ''}">
        `, () => {
            f.nome = $('ed_nome').value; f.cnpj = $('ed_cnpj').value;
            f.contato = $('ed_contato').value; f.telefone = $('ed_tel').value;
            f.email = $('ed_email').value; f.obs = $('ed_obs').value;
            salvar('fornecedores', lista);
            registrarLog('editar', `Fornecedor "${f.nome}" editado`);
            fecharModal(); atualizarTudo();
        });
    };

    /* AGENDAMENTOS */
    function preencherSelects() {
        const pacientes = carregar('pacientes');
        const profissionais = carregar('profissionais');
        const servicos = carregar('servicos');

        $('agPaciente').innerHTML = '<option value="">Selecione…</option>' +
            pacientes.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        $('agProfissional').innerHTML = '<option value="">Selecione…</option>' +
            profissionais.map(p => `<option value="${p.id}">${p.nome} — ${p.especialidade}</option>`).join('');
        $('agServico').innerHTML = '<option value="">Selecione…</option>' +
            servicos.map(s => `<option value="${s.id}">${s.nome} — ${formatarMoeda(s.preco)}</option>`).join('');
    }

    function renderAgendamentos() {
        const lista = carregar('agendamentos');
        const pacientes = carregar('pacientes');
        const profissionais = carregar('profissionais');
        const servicos = carregar('servicos');
        const pagamentos = carregar('pagamentos');

        const nomePac = (id) => (pacientes.find(p => p.id === id) || {}).nome || '—';
        const nomePro = (id) => (profissionais.find(p => p.id === id) || {}).nome || '—';
        const nomeSer = (id) => (servicos.find(s => s.id === id) || {}).nome || '—';

        lista.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

        const tbody = $('tabelaAgendamentos');
        tbody.innerHTML = '';
        $('vazioAgendamentos').style.display = lista.length ? 'none' : 'block';

        lista.forEach(a => {
            const pago = pagamentos.find(p => p.agendamentoId === a.id && p.status === 'pago');
            const pendente = pagamentos.find(p => p.agendamentoId === a.id && p.status === 'pendente');
            const podeReceber = a.status === 'realizado' && !pago;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(a.data)}</td><td>${a.hora}</td>
                <td>${nomePac(a.pacienteId)}</td><td>${nomePro(a.profissionalId)}</td>
                <td>${nomeSer(a.servicoId)}</td>
                <td><span class="badge ${a.status}">${a.status}</span> ${pago ? '💰' : pendente ? '⏳' : ''}</td>
                <td>
                    ${podeReceber ? `<button class="btn btn-success btn-sm" onclick="abrirRecebimento('${a.id}')" title="Receber pagamento">💰</button>` : ''}
                    <button class="btn btn-info btn-sm" onclick="editarAgendamento('${a.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('agendamentos','${a.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    $('formAgendamento').addEventListener('submit', (e) => {
        e.preventDefault();
        const lista = carregar('agendamentos');
        const novo = {
            id: gerarId(), pacienteId: $('agPaciente').value,
            profissionalId: $('agProfissional').value, servicoId: $('agServico').value,
            data: $('agData').value, hora: $('agHora').value,
            status: $('agStatus').value, obs: $('agObs').value
        };
        lista.push(novo);
        salvar('agendamentos', lista);
        registrarLog('criar', `Agendamento em ${formatarData(novo.data)} às ${novo.hora}`);
        e.target.reset();
        atualizarTudo();
    });

    window.editarAgendamento = (id) => {
        const lista = carregar('agendamentos');
        const a = lista.find(x => x.id === id);
        const pacientes = carregar('pacientes');
        const profissionais = carregar('profissionais');
        const servicos = carregar('servicos');
        const opt = (arr, sel) => arr.map(x =>
            `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${x.nome}</option>`).join('');

        abrirModal('Editar Agendamento', `
            <label>Paciente</label>
            <select id="ed_pac"><option value="">Selecione…</option>${opt(pacientes, a.pacienteId)}</select>
            <label>Profissional</label>
            <select id="ed_pro"><option value="">Selecione…</option>${opt(profissionais, a.profissionalId)}</select>
            <label>Serviço</label>
            <select id="ed_ser"><option value="">Selecione…</option>${opt(servicos, a.servicoId)}</select>
            <label>Data</label><input type="date" id="ed_data" value="${a.data}">
            <label>Hora</label><input type="time" id="ed_hora" value="${a.hora}">
            <label>Status</label>
            <select id="ed_status">
                ${['agendado','confirmado','realizado','cancelado'].map(s =>
                    `<option value="${s}" ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <label>Observações</label><input id="ed_obs" value="${a.obs || ''}">
        `, () => {
            a.pacienteId = $('ed_pac').value; a.profissionalId = $('ed_pro').value;
            a.servicoId = $('ed_ser').value; a.data = $('ed_data').value;
            a.hora = $('ed_hora').value; a.status = $('ed_status').value;
            a.obs = $('ed_obs').value;
            salvar('agendamentos', lista);
            registrarLog('editar', `Agendamento de ${formatarData(a.data)} editado`);
            fecharModal(); atualizarTudo();
        });
    };

    /* HORÁRIOS */
    const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    function renderHorarios() {
        let horarios = carregar('horarios');
        if (!horarios.length) {
            horarios = DIAS.map((nome, i) => ({
                dia: i, nome, aberto: i >= 1 && i <= 5, inicio: '08:00', fim: '18:00'
            }));
            salvar('horarios', horarios);
        }
        $('listaHorarios').innerHTML = horarios.map((h, idx) => `
            <div class="horario-linha">
                <strong>${h.nome}</strong>
                <label style="display:flex;align-items:center;gap:6px;margin:0;">
                    <input type="checkbox" data-idx="${idx}" class="chk-aberto" ${h.aberto ? 'checked' : ''}> Aberto
                </label>
                <input type="time" data-idx="${idx}" class="inp-inicio" value="${h.inicio}" ${!h.aberto ? 'disabled' : ''}>
                <input type="time" data-idx="${idx}" class="inp-fim" value="${h.fim}" ${!h.aberto ? 'disabled' : ''}>
            </div>
        `).join('');

        document.querySelectorAll('.chk-aberto').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const idx = e.target.dataset.idx;
                document.querySelector(`.inp-inicio[data-idx="${idx}"]`).disabled = !e.target.checked;
                document.querySelector(`.inp-fim[data-idx="${idx}"]`).disabled = !e.target.checked;
            });
        });
    }

    $('btnSalvarHorarios').addEventListener('click', () => {
        const horarios = carregar('horarios');
        horarios.forEach((h, idx) => {
            h.aberto = document.querySelector(`.chk-aberto[data-idx="${idx}"]`).checked;
            h.inicio = document.querySelector(`.inp-inicio[data-idx="${idx}"]`).value;
            h.fim = document.querySelector(`.inp-fim[data-idx="${idx}"]`).value;
        });
        salvar('horarios', horarios);
        registrarLog('editar', `Horários de atendimento atualizados`);
        alert('✅ Horários salvos!');
    });
    /* DASHBOARD */
    function renderDashboard() {
        const agendamentos = carregar('agendamentos');
        const pacientes = carregar('pacientes');
        const estoque = carregar('estoque');
        const movimentacoes = carregar('movimentacoes');
        const pagamentos = carregar('pagamentos');
        const servicos = carregar('servicos');

        const hoje = hojeStr();
        const mes = mesStr();
        const agHoje = agendamentos.filter(a => a.data === hoje);
        const estoqueBaixo = estoque.filter(i => i.quantidade <= i.minimo);
        const vencendo = estoque.filter(i => { const d = diasAteVencer(i.validade); return d !== null && d >= 0 && d <= 30; });
        const movHoje = movimentacoes.filter(m => m.data === hoje);

        const pagosHoje = pagamentos.filter(p => p.status === 'pago' && p.data === hoje);
        const fatHoje = pagosHoje.reduce((s, p) => s + Number(p.valor || 0), 0);

        const pagosMes = pagamentos.filter(p => p.status === 'pago' && (p.data || '').startsWith(mes));
        const fatMes = pagosMes.reduce((s, p) => s + Number(p.valor || 0), 0);

        const pendentes = pagamentos.filter(p => p.status === 'pendente');
        const aReceber = pendentes.reduce((s, p) => s + Number(p.valor || 0), 0);

        $('statAgendamentos').textContent = agHoje.length;
        $('statFaturamentoHoje').textContent = formatarMoeda(fatHoje);
        $('statEstoqueBaixo').textContent = estoqueBaixo.length;
        $('statVencendo').textContent = vencendo.length;
        $('statFaturamentoMes').textContent = formatarMoeda(fatMes);
        $('statAReceber').textContent = formatarMoeda(aReceber);
        $('statPacientes').textContent = pacientes.length;
        $('statMovHoje').textContent = movHoje.length;

        const proximos = agendamentos
            .filter(a => a.data >= hoje && a.status !== 'cancelado')
            .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
            .slice(0, 6);

        const pacMap = Object.fromEntries(pacientes.map(p => [p.id, p.nome]));
        const proMap = Object.fromEntries(carregar('profissionais').map(p => [p.id, p.nome]));
        const serMap = Object.fromEntries(servicos.map(s => [s.id, s.nome]));

        const tbody = $('tabelaProximos');
        tbody.innerHTML = '';
        $('vazioProximos').style.display = proximos.length ? 'none' : 'block';
        proximos.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(a.data)}</td><td>${a.hora}</td>
                <td>${pacMap[a.pacienteId] || '—'}</td>
                <td>${proMap[a.profissionalId] || '—'}</td>
                <td>${serMap[a.servicoId] || '—'}</td>
                <td><span class="badge ${a.status}">${a.status}</span></td>`;
            tbody.appendChild(tr);
        });

        const ultimosPag = [...pagamentos]
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .slice(0, 6);

        const agMap = Object.fromEntries(agendamentos.map(a => [a.id, a]));
        const tbodyPag = $('tabelaUltimosPagamentos');
        tbodyPag.innerHTML = '';
        $('vazioUltimosPagamentos').style.display = ultimosPag.length ? 'none' : 'block';
        ultimosPag.forEach(p => {
            const ag = agMap[p.agendamentoId] || {};
            const forma = FORMAS_PAG[p.forma] || { nome: p.forma, emoji: '💰' };
            const cls = p.status === 'pago' ? 'valor-destaque' : 'valor-pendente';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(p.data)}</td>
                <td>${pacMap[ag.pacienteId] || '—'}</td>
                <td>${serMap[ag.servicoId] || '—'}</td>
                <td><span class="${cls}">${formatarMoeda(p.valor)}</span></td>
                <td><span class="forma-pagamento">${forma.emoji} ${forma.nome}</span></td>
                <td><span class="badge ${p.status}">${p.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}</span></td>`;
            tbodyPag.appendChild(tr);
        });
    }

    /* FINANCEIRO */
    let filtroPag = 'todos';
    document.querySelectorAll('.filtro-pag').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-pag').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            filtroPag = btn.dataset.filtro;
            renderPagamentos();
        });
    });

    function preencherSelectAgendamentosPag() {
        const ags = carregar('agendamentos');
        const pacientes = carregar('pacientes');
        const servicos = carregar('servicos');
        const pagamentos = carregar('pagamentos');

        const pacMap = Object.fromEntries(pacientes.map(p => [p.id, p.nome]));
        const serMap = Object.fromEntries(servicos.map(s => [s.id, s]));

        const disponiveis = ags
            .filter(a => a.status === 'realizado')
            .filter(a => !pagamentos.find(p => p.agendamentoId === a.id))
            .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));

        const sel = $('pagAgendamento');
        if (!sel) return;
        if (disponiveis.length === 0) {
            sel.innerHTML = '<option value="">Nenhum agendamento pendente de pagamento</option>';
            return;
        }

        sel.innerHTML = '<option value="">Selecione…</option>' + disponiveis.map(a => {
            const s = serMap[a.servicoId] || {};
            return `<option value="${a.id}" data-valor="${s.preco || 0}">${formatarData(a.data)} ${a.hora} — ${pacMap[a.pacienteId] || '?'} — ${s.nome || '?'} (${formatarMoeda(s.preco)})</option>`;
        }).join('');
    }

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'pagAgendamento') {
            const sel = e.target;
            const opt = sel.options[sel.selectedIndex];
            const valor = opt?.dataset?.valor;
            if (valor && $('pagValor')) $('pagValor').value = parseFloat(valor).toFixed(2);
        }
    });

    function renderPagamentos() {
        let lista = carregar('pagamentos');
        if (filtroPag !== 'todos') lista = lista.filter(p => p.status === filtroPag);
        lista.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

        const agendamentos = carregar('agendamentos');
        const pacientes = carregar('pacientes');
        const servicos = carregar('servicos');
        const agMap = Object.fromEntries(agendamentos.map(a => [a.id, a]));
        const pacMap = Object.fromEntries(pacientes.map(p => [p.id, p.nome]));
        const serMap = Object.fromEntries(servicos.map(s => [s.id, s.nome]));

        const tbody = $('tabelaPagamentos');
        if (!tbody) return;
        tbody.innerHTML = '';
        $('vazioPagamentos').style.display = lista.length ? 'none' : 'block';

        lista.forEach(p => {
            const ag = agMap[p.agendamentoId] || {};
            const forma = FORMAS_PAG[p.forma] || { nome: p.forma, emoji: '💰' };
            const cls = p.status === 'pago' ? 'valor-destaque' : 'valor-pendente';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(p.data)}</td>
                <td>${pacMap[ag.pacienteId] || '—'}</td>
                <td>${serMap[ag.servicoId] || '—'}</td>
                <td><span class="${cls}">${formatarMoeda(p.valor)}</span></td>
                <td><span class="forma-pagamento">${forma.emoji} ${forma.nome}</span></td>
                <td><span class="badge ${p.status}">${p.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}</span></td>
                <td>
                    ${p.status === 'pendente' ? `<button class="btn-receber" onclick="marcarComoPago('${p.id}')" title="Marcar como pago">💰 Receber</button>` : ''}
                    <button class="btn btn-info btn-sm" onclick="editarPagamento('${p.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirItem('pagamentos','${p.id}')">🗑️</button>
                </td>`;
            tbody.appendChild(tr);
        });

        atualizarResumoFinanceiro();
    }

    function atualizarResumoFinanceiro() {
        const pagamentos = carregar('pagamentos');
        const hoje = hojeStr();
        const mes = mesStr();

        const pagosMes = pagamentos.filter(p => p.status === 'pago' && (p.data || '').startsWith(mes));
        const fatMes = pagosMes.reduce((s, p) => s + Number(p.valor || 0), 0);

        const pagosHoje = pagamentos.filter(p => p.status === 'pago' && p.data === hoje);
        const fatHoje = pagosHoje.reduce((s, p) => s + Number(p.valor || 0), 0);

        const pendentes = pagamentos.filter(p => p.status === 'pendente');
        const aReceber = pendentes.reduce((s, p) => s + Number(p.valor || 0), 0);

        const totalPagos = pagamentos.filter(p => p.status === 'pago');
        const ticket = totalPagos.length > 0
            ? totalPagos.reduce((s, p) => s + Number(p.valor || 0), 0) / totalPagos.length
            : 0;

        if ($('finFaturamentoMes')) $('finFaturamentoMes').textContent = formatarMoeda(fatMes);
        if ($('finFaturamentoHoje')) $('finFaturamentoHoje').textContent = formatarMoeda(fatHoje);
        if ($('finPendente')) $('finPendente').textContent = formatarMoeda(aReceber);
        if ($('finTicket')) $('finTicket').textContent = formatarMoeda(ticket);
    }

    $('formPagamento').addEventListener('submit', (e) => {
        e.preventDefault();
        const agendamentoId = $('pagAgendamento').value;
        if (!agendamentoId) return alert('Selecione um agendamento.');

        const lista = carregar('pagamentos');
        if (lista.find(p => p.agendamentoId === agendamentoId)) {
            return alert('❌ Este agendamento já possui pagamento registrado.');
        }

        const u = usuarioAtual();
        const novo = {
            id: gerarId(), agendamentoId,
            valor: parseFloat($('pagValor').value),
            forma: $('pagForma').value,
            status: $('pagStatus').value,
            data: $('pagData').value,
            obs: $('pagObs').value,
            usuario: u.nome
        };
        lista.push(novo);
        salvar('pagamentos', lista);

        const forma = FORMAS_PAG[novo.forma] || { nome: novo.forma };
        registrarLog('criar', `Pagamento de ${formatarMoeda(novo.valor)} (${forma.nome}) registrado`);

        e.target.reset();
        $('pagData').value = hojeStr();
        atualizarTudo();
    });

    window.marcarComoPago = (id) => {
        const lista = carregar('pagamentos');
        const p = lista.find(x => x.id === id);
        if (!p) return;
        if (!confirm(`Confirmar recebimento de ${formatarMoeda(p.valor)}?`)) return;
        p.status = 'pago';
        p.data = hojeStr();
        salvar('pagamentos', lista);
        registrarLog('editar', `Pagamento de ${formatarMoeda(p.valor)} marcado como pago`);
        atualizarTudo();
    };

    window.editarPagamento = (id) => {
        const lista = carregar('pagamentos');
        const p = lista.find(x => x.id === id);
        const agendamentos = carregar('agendamentos');
        const pacientes = carregar('pacientes');
        const servicos = carregar('servicos');
        const ag = agendamentos.find(a => a.id === p.agendamentoId) || {};
        const pacNome = (pacientes.find(x => x.id === ag.pacienteId) || {}).nome || '—';
        const serNome = (servicos.find(x => x.id === ag.servicoId) || {}).nome || '—';

        abrirModal('Editar Pagamento', `
            <p style="margin-bottom:14px; color:var(--text-light); font-size:13px;">
                <strong>${pacNome}</strong> — ${serNome}
            </p>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" id="ed_valor" value="${p.valor}" required>
            <label>Forma de Pagamento</label>
            <select id="ed_forma">
                ${Object.entries(FORMAS_PAG).map(([k, v]) =>
                    `<option value="${k}" ${p.forma === k ? 'selected' : ''}>${v.emoji} ${v.nome}</option>`).join('')}
            </select>
            <label>Status</label>
            <select id="ed_status">
                <option value="pago" ${p.status === 'pago' ? 'selected' : ''}>✅ Pago</option>
                <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option>
            </select>
            <label>Data</label>
            <input type="date" id="ed_data" value="${p.data}">
            <label>Observações</label>
            <input id="ed_obs" value="${p.obs || ''}">
        `, () => {
            p.valor = parseFloat($('ed_valor').value);
            p.forma = $('ed_forma').value;
            p.status = $('ed_status').value;
            p.data = $('ed_data').value;
            p.obs = $('ed_obs').value;
            salvar('pagamentos', lista);
            registrarLog('editar', `Pagamento editado — ${formatarMoeda(p.valor)}`);
            fecharModal(); atualizarTudo();
        });
    };

    window.abrirRecebimento = (agendamentoId) => {
        const ags = carregar('agendamentos');
        const ag = ags.find(a => a.id === agendamentoId);
        const pacientes = carregar('pacientes');
        const servicos = carregar('servicos');
        const pacNome = (pacientes.find(x => x.id === ag.pacienteId) || {}).nome || '?';
        const ser = servicos.find(s => s.id === ag.servicoId) || {};

        abrirModal('💰 Registrar Recebimento', `
            <p style="margin-bottom:14px; color:var(--text-light); font-size:13px;">
                <strong>${pacNome}</strong> — ${ser.nome || '?'}<br>
                ${formatarData(ag.data)} às ${ag.hora}
            </p>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" id="rc_valor" value="${(ser.preco || 0).toFixed(2)}" required>
            <label>Forma de Pagamento</label>
            <select id="rc_forma">
                ${Object.entries(FORMAS_PAG).map(([k, v]) =>
                    `<option value="${k}">${v.emoji} ${v.nome}</option>`).join('')}
            </select>
            <label>Status</label>
            <select id="rc_status">
                <option value="pago">✅ Pago agora</option>
                <option value="pendente">⏳ Deixar pendente</option>
            </select>
            <label>Observações</label>
            <input id="rc_obs" placeholder="Opcional">
        `, () => {
            const lista = carregar('pagamentos');
            const u = usuarioAtual();
            const novo = {
                id: gerarId(), agendamentoId,
                valor: parseFloat($('rc_valor').value),
                forma: $('rc_forma').value,
                status: $('rc_status').value,
                data: hojeStr(),
                obs: $('rc_obs').value,
                usuario: u.nome
            };
            lista.push(novo);
            salvar('pagamentos', lista);
            const forma = FORMAS_PAG[novo.forma] || { nome: novo.forma };
            registrarLog('criar', `Recebimento de ${formatarMoeda(novo.valor)} (${forma.nome}) registrado`);
            fecharModal(); atualizarTudo();
        });
    };
    /* RELATÓRIOS */
    let periodoRelatorio = '30';
    let dataInicioRel = null;
    let dataFimRel = null;

    function calcularPeriodo() {
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const fim = new Date(hoje);
        let inicio = new Date(hoje);

        if (periodoRelatorio === 'custom' && dataInicioRel && dataFimRel) {
            return { inicio: dataInicioRel, fim: dataFimRel };
        }

        if (periodoRelatorio === '0') {
            // hoje
        } else if (periodoRelatorio === '7') {
            inicio.setDate(inicio.getDate() - 6);
        } else if (periodoRelatorio === '30') {
            inicio.setDate(inicio.getDate() - 29);
        } else if (periodoRelatorio === 'mes') {
            inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        } else if (periodoRelatorio === 'ano') {
            inicio = new Date(hoje.getFullYear(), 0, 1);
        }

        return {
            inicio: inicio.toISOString().split('T')[0],
            fim: fim.toISOString().split('T')[0]
        };
    }

    function renderRelatorios() {
        if (!$('tela-relatorios')) return;

        const periodo = calcularPeriodo();
        $('relDe').textContent = formatarData(periodo.inicio);
        $('relAte').textContent = formatarData(periodo.fim);

        const agendamentos = carregar('agendamentos').filter(a =>
            a.data >= periodo.inicio && a.data <= periodo.fim
        );
        const profissionais = carregar('profissionais');
        const servicos = carregar('servicos');
        const pacientes = carregar('pacientes');

        const total = agendamentos.length;
        const realizados = agendamentos.filter(a => a.status === 'realizado');
        const cancelados = agendamentos.filter(a => a.status === 'cancelado');
        const taxa = total > 0 ? Math.round((realizados.length / total) * 100) : 0;

        const servMap = Object.fromEntries(servicos.map(s => [s.id, s]));
        let faturamento = 0;
        realizados.forEach(a => {
            const s = servMap[a.servicoId];
            if (s) faturamento += s.preco;
        });
        const ticket = realizados.length > 0 ? faturamento / realizados.length : 0;

        $('relTotal').textContent = total;
        $('relRealizados').textContent = realizados.length;
        $('relCancelados').textContent = cancelados.length;
        $('relTaxa').textContent = taxa + '%';
        $('relFaturamento').textContent = formatarMoeda(faturamento);
        $('relTicket').textContent = formatarMoeda(ticket);

        const contServ = {};
        agendamentos.forEach(a => {
            if (!contServ[a.servicoId]) contServ[a.servicoId] = { total: 0, realizados: 0 };
            contServ[a.servicoId].total++;
            if (a.status === 'realizado') contServ[a.servicoId].realizados++;
        });
        const rankServ = Object.entries(contServ)
            .map(([id, c]) => {
                const s = servicos.find(x => x.id === id) || {};
                return { id, nome: s.nome || '—', preco: s.preco || 0, ...c };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        renderRanking('rankingServicos', 'vazioRankServ', rankServ, 'total',
            (s) => `${s.realizados} realizados • ${formatarMoeda(s.preco)}`);

        const contProf = {};
        agendamentos.forEach(a => {
            if (!contProf[a.profissionalId]) contProf[a.profissionalId] = { total: 0, realizados: 0, faturamento: 0 };
            contProf[a.profissionalId].total++;
            if (a.status === 'realizado') {
                contProf[a.profissionalId].realizados++;
                const s = servMap[a.servicoId];
                if (s) contProf[a.profissionalId].faturamento += s.preco;
            }
        });
        const rankProf = Object.entries(contProf)
            .map(([id, c]) => {
                const p = profissionais.find(x => x.id === id) || {};
                return { id, nome: p.nome || '—', esp: p.especialidade || '—', ...c };
            })
            .sort((a, b) => b.faturamento - a.faturamento || b.realizados - a.realizados)
            .slice(0, 10);

        renderRanking('rankingProfissionais', 'vazioRankProf', rankProf, 'faturamento',
            (p) => `${p.esp} • ${p.realizados} realizados`, true);

        const contPac = {};
        agendamentos.forEach(a => {
            if (!contPac[a.pacienteId]) contPac[a.pacienteId] = { total: 0, realizados: 0 };
            contPac[a.pacienteId].total++;
            if (a.status === 'realizado') contPac[a.pacienteId].realizados++;
        });
        const rankPac = Object.entries(contPac)
            .map(([id, c]) => {
                const p = pacientes.find(x => x.id === id) || {};
                return { id, nome: p.nome || '—', ...c };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        renderRanking('rankingPacientes', 'vazioRankPac', rankPac, 'total',
            (p) => `${p.realizados} realizados`);

        const statusCount = { agendado: 0, confirmado: 0, realizado: 0, cancelado: 0 };
        agendamentos.forEach(a => { statusCount[a.status] = (statusCount[a.status] || 0) + 1; });

        $('breakdownStatus').innerHTML = Object.entries(statusCount).map(([st, n]) => {
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return `
                <div class="breakdown-item ${st}">
                    <div class="num">${n}</div>
                    <div class="lbl">${st}</div>
                    <div class="pct">${pct}% do total</div>
                </div>`;
        }).join('');

        renderGraficoDiario(agendamentos, periodo);

        const detProf = profissionais.map(p => {
            const ags = agendamentos.filter(a => a.profissionalId === p.id);
            const real = ags.filter(a => a.status === 'realizado');
            const canc = ags.filter(a => a.status === 'cancelado');
            const fat = real.reduce((soma, a) => {
                const s = servMap[a.servicoId];
                return soma + (s ? s.preco : 0);
            }, 0);
            const tx = ags.length > 0 ? Math.round((real.length / ags.length) * 100) : 0;
            return { ...p, total: ags.length, realizados: real.length, cancelados: canc.length, faturamento: fat, taxa: tx };
        }).filter(p => p.total > 0).sort((a, b) => b.faturamento - a.faturamento);

        const tbodyProf = $('tabelaDetProfissionais');
        tbodyProf.innerHTML = '';
        $('vazioDetProf').style.display = detProf.length ? 'none' : 'block';
        detProf.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.nome}</strong></td>
                <td>${p.especialidade}</td>
                <td>${p.total}</td>
                <td>${p.realizados}</td>
                <td>${p.cancelados}</td>
                <td>${formatarMoeda(p.faturamento)}</td>
                <td><span class="badge ${p.taxa >= 70 ? 'estoque-ok' : p.taxa >= 40 ? 'estoque-baixo' : 'cancelado'}">${p.taxa}%</span></td>`;
            tbodyProf.appendChild(tr);
        });

        const detServ = servicos.map(s => {
            const ags = agendamentos.filter(a => a.servicoId === s.id);
            const real = ags.filter(a => a.status === 'realizado');
            return { ...s, total: ags.length, realizados: real.length, faturamento: real.length * s.preco };
        }).filter(s => s.total > 0).sort((a, b) => b.faturamento - a.faturamento);

        const tbodyServ = $('tabelaDetServicos');
        tbodyServ.innerHTML = '';
        $('vazioDetServ').style.display = detServ.length ? 'none' : 'block';
        detServ.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.nome}</strong></td>
                <td>${formatarMoeda(s.preco)}</td>
                <td>${s.total}</td>
                <td>${s.realizados}</td>
                <td>${formatarMoeda(s.faturamento)}</td>`;
            tbodyServ.appendChild(tr);
        });
    }

    function renderRanking(containerId, vazioId, lista, campoValor, formataDetalhe, ehMoeda = false) {
        const container = $(containerId);
        if (!container) return;
        $(vazioId).style.display = lista.length ? 'none' : 'block';
        if (lista.length === 0) { container.innerHTML = ''; return; }
        const max = Math.max(...lista.map(i => i[campoValor]), 1);
        container.innerHTML = lista.map((item, idx) => {
            const pos = idx + 1;
            const posClass = pos === 1 ? 'ouro' : pos === 2 ? 'prata' : pos === 3 ? 'bronze' : '';
            const pct = Math.round((item[campoValor] / max) * 100);
            const valor = ehMoeda ? formatarMoeda(item[campoValor]) : item[campoValor];
            return `
                <div class="ranking-item">
                    <div class="ranking-pos ${posClass}">${pos}</div>
                    <div class="ranking-info">
                        <div class="nome">${item.nome}</div>
                        <div class="detalhe">${formataDetalhe(item)}</div>
                        <div class="ranking-barra">
                            <div class="ranking-barra-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>
                    <div class="ranking-valor">${valor}</div>
                </div>`;
        }).join('');
    }

    function renderGraficoDiario(agendamentos, periodo) {
        const container = $('graficoDiario');
        if (!container) return;
        const porDia = {};
        agendamentos.forEach(a => { porDia[a.data] = (porDia[a.data] || 0) + 1; });
        const dias = [];
        const inicio = new Date(periodo.inicio + 'T00:00:00');
        const fim = new Date(periodo.fim + 'T00:00:00');
        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
            const iso = d.toISOString().split('T')[0];
            dias.push({ iso, valor: porDia[iso] || 0 });
        }
        const max = Math.max(...dias.map(d => d.valor), 1);
        const alturaMax = 150;
        container.innerHTML = dias.map(d => {
            const h = Math.round((d.valor / max) * alturaMax);
            const [, mm, dd] = d.iso.split('-');
            return `
                <div class="grafico-coluna">
                    <div class="valor">${d.valor > 0 ? d.valor : ''}</div>
                    <div class="barra" style="height: ${h}px;"></div>
                    <div class="grafico-tooltip">${dd}/${mm}: ${d.valor} agend.</div>
                </div>`;
        }).join('');
        $('legendaInicio').textContent = formatarData(dias[0]?.iso);
        $('legendaFim').textContent = formatarData(dias[dias.length-1]?.iso);
    }

    document.querySelectorAll('.filtro-periodo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-periodo').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            periodoRelatorio = btn.dataset.periodo;
            if (periodoRelatorio === 'custom') {
                $('periodoCustom').style.display = 'grid';
            } else {
                $('periodoCustom').style.display = 'none';
                renderRelatorios();
            }
        });
    });

    $('btnAplicarPeriodo')?.addEventListener('click', () => {
        const i = $('relDataInicio').value;
        const f = $('relDataFim').value;
        if (!i || !f) return alert('Escolha as duas datas');
        if (i > f) return alert('Data inicial maior que a final');
        dataInicioRel = i;
        dataFimRel = f;
        renderRelatorios();
    });

    window.exportarCSV = (tipo) => {
        const periodo = calcularPeriodo();
        const agendamentos = carregar('agendamentos').filter(a =>
            a.data >= periodo.inicio && a.data <= periodo.fim
        );
        const servMap = Object.fromEntries(carregar('servicos').map(s => [s.id, s]));
        let csv = '';
        let nome = '';

        if (tipo === 'servicos') {
            nome = 'servicos';
            csv = 'Servico;Preco;Total;Realizados;Faturamento\n';
            carregar('servicos').forEach(s => {
                const ags = agendamentos.filter(a => a.servicoId === s.id);
                const real = ags.filter(a => a.status === 'realizado');
                if (ags.length > 0) {
                    csv += `"${s.nome}";${s.preco.toFixed(2)};${ags.length};${real.length};${(real.length * s.preco).toFixed(2)}\n`;
                }
            });
        } else if (tipo === 'profissionais') {
            nome = 'profissionais';
            csv = 'Profissional;Especialidade;Total;Realizados;Cancelados;Faturamento\n';
            carregar('profissionais').forEach(p => {
                const ags = agendamentos.filter(a => a.profissionalId === p.id);
                const real = ags.filter(a => a.status === 'realizado');
                const canc = ags.filter(a => a.status === 'cancelado');
                const fat = real.reduce((soma, a) => {
                    const s = servMap[a.servicoId];
                    return soma + (s ? s.preco : 0);
                }, 0);
                if (ags.length > 0) {
                    csv += `"${p.nome}";"${p.especialidade}";${ags.length};${real.length};${canc.length};${fat.toFixed(2)}\n`;
                }
            });
        } else if (tipo === 'diario') {
            nome = 'movimento-diario';
            csv = 'Data;Total;Realizados;Cancelados\n';
            const porDia = {};
            agendamentos.forEach(a => {
                if (!porDia[a.data]) porDia[a.data] = { total: 0, real: 0, canc: 0 };
                porDia[a.data].total++;
                if (a.status === 'realizado') porDia[a.data].real++;
                if (a.status === 'cancelado') porDia[a.data].canc++;
            });
            Object.keys(porDia).sort().forEach(d => {
                csv += `${formatarData(d)};${porDia[d].total};${porDia[d].real};${porDia[d].canc}\n`;
            });
        }

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio-${nome}-${hojeStr()}.csv`;
        link.click();
        registrarLog('criar', `Relatório "${nome}" exportado (CSV)`);
    };

    /* USUÁRIOS */
    function renderUsuarios() {
        const lista = carregar('usuarios');
        const tbody = $('tabelaUsuarios');
        if (!tbody) return;
        tbody.innerHTML = '';
        $('vazioUsuarios').style.display = lista.length ? 'none' : 'block';
        const atual = usuarioAtual();
        lista.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.nome}</td>
                <td>${u.email}</td>
                <td><span class="badge perfil-${u.perfil}">${u.perfil}</span></td>
                <td><span class="badge ${u.ativo ? 'ativo' : 'inativo'}">${u.ativo ? '✔ Ativo' : '✕ Inativo'}</span></td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="editarUsuario('${u.id}')">✏️</button>
                    ${u.id !== atual.id ? `<button class="btn btn-danger btn-sm" onclick="excluirItem('usuarios','${u.id}')">🗑️</button>` : ''}
                </td>`;
            tbody.appendChild(tr);
        });
    }

    $('formUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const lista = carregar('usuarios');
        const email = $('usuEmail').value.toLowerCase().trim();
        if (lista.find(u => u.email === email)) return alert('❌ Este e-mail já está cadastrado!');
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Cadastrando...';
        const novo = await criarUsuario($('usuNome').value, email, $('usuSenha').value, $('usuPerfil').value);
        lista.push(novo);
        salvar('usuarios', lista);
        registrarLog('criar', `Usuário "${novo.nome}" (${novo.perfil}) cadastrado`);
        e.target.reset();
        btn.disabled = false;
        btn.textContent = '➕ Cadastrar';
        atualizarTudo();
    });

    window.editarUsuario = (id) => {
        const lista = carregar('usuarios');
        const u = lista.find(x => x.id === id);
        abrirModal('Editar Usuário', `
            <label>Nome</label><input id="ed_nome" value="${u.nome}">
            <label>E-mail</label><input id="ed_email" value="${u.email}">
            <label>Perfil</label>
            <select id="ed_perfil">
                <option value="admin" ${u.perfil === 'admin' ? 'selected' : ''}>Administrador</option>
                <option value="recepcao" ${u.perfil === 'recepcao' ? 'selected' : ''}>Recepção</option>
                <option value="profissional" ${u.perfil === 'profissional' ? 'selected' : ''}>Profissional</option>
            </select>
            <label>Status</label>
            <select id="ed_ativo">
                <option value="1" ${u.ativo ? 'selected' : ''}>Ativo</option>
                <option value="0" ${!u.ativo ? 'selected' : ''}>Inativo</option>
            </select>
            <label>Nova senha (deixe em branco para manter)</label>
            <input type="password" id="ed_senha" minlength="6" placeholder="••••••">
        `, async () => {
            u.nome = $('ed_nome').value;
            u.email = $('ed_email').value.toLowerCase().trim();
            u.perfil = $('ed_perfil').value;
            u.ativo = $('ed_ativo').value === '1';
            const novaSenha = $('ed_senha').value;
            if (novaSenha) {
                u.salt = gerarSalt();
                u.senhaHash = await hashSenha(novaSenha, u.salt);
            }
            salvar('usuarios', lista);
            registrarLog('editar', `Usuário "${u.nome}" editado`);
            fecharModal(); atualizarTudo();
        });
    };

    /* LOGS */
    let filtroLogs = 'todos';
    document.querySelectorAll('.filtro-logs').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-logs').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            filtroLogs = btn.dataset.filtro;
            renderLogs();
        });
    });

    function renderLogs() {
        let lista = carregar('logs');
        if (filtroLogs !== 'todos') lista = lista.filter(l => l.acao === filtroLogs);
        lista.sort((a, b) => b.id.localeCompare(a.id));
        const tbody = $('tabelaLogs');
        if (!tbody) return;
        tbody.innerHTML = '';
        $('vazioLogs').style.display = lista.length ? 'none' : 'block';
        lista.slice(0, 200).forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${l.data}</td>
                <td>${l.usuario}</td>
                <td><span class="log-acao ${l.acao}">${l.acao}</span></td>
                <td>${l.detalhe}</td>`;
            tbody.appendChild(tr);
        });
    }

    $('btnLimparLogs').addEventListener('click', () => {
        if (!confirm('Apagar todos os logs de atividades?')) return;
        salvar('logs', []);
        registrarLog('excluir', 'Todos os logs foram limpos');
        renderLogs();
    });

    /* EXCLUSÃO */
    window.excluirItem = (chave, id) => {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        let lista = carregar(chave);
        const item = lista.find(x => x.id === id);
        lista = lista.filter(x => x.id !== id);
        salvar(chave, lista);
        registrarLog('excluir', `${chave}: "${item?.nome || item?.email || id}" excluído`);
        atualizarTudo();
    };

    /* NOTIFICAÇÕES */
    function calcularNotificacoes() {
        const notifs = [];
        const hoje = new Date();
        const hojeS = hojeStr();
        const agoraMin = hoje.getHours() * 60 + hoje.getMinutes();

        const estoque = carregar('estoque');
        const agendamentos = carregar('agendamentos');
        const pacientes = carregar('pacientes');
        const pagamentos = carregar('pagamentos');
        const pacMap = Object.fromEntries(pacientes.map(p => [p.id, p.nome]));

        estoque.filter(i => i.quantidade <= i.minimo).forEach(i => {
            notifs.push({ tipo: 'estoque', icone: '📦',
                titulo: `Estoque baixo: ${i.nome}`,
                descricao: `Apenas ${i.quantidade} un. (mínimo ${i.minimo})`,
                tela: 'estoque', nivel: 'urgente' });
        });

        estoque.forEach(i => {
            const d = diasAteVencer(i.validade);
            if (d === null) return;
            if (d < 0) {
                notifs.push({ tipo: 'vencido', icone: '🚫',
                    titulo: `Vencido: ${i.nome}`,
                    descricao: `Venceu há ${Math.abs(d)} dia(s)`,
                    tela: 'estoque', nivel: 'urgente' });
            } else if (d <= 60) {
                notifs.push({ tipo: 'validade', icone: '⏰',
                    titulo: `Vence em ${d} dia(s): ${i.nome}`,
                    descricao: `Validade: ${formatarData(i.validade)}`,
                    tela: 'estoque', nivel: d <= 30 ? 'urgente' : 'aviso' });
            }
        });

        agendamentos
            .filter(a => a.data === hojeS && a.status !== 'cancelado' && a.status !== 'realizado')
            .forEach(a => {
                const [h, m] = a.hora.split(':').map(Number);
                const diff = (h * 60 + m) - agoraMin;
                if (diff >= 0 && diff <= 120) {
                    notifs.push({
                        tipo: 'agendamento',
                        icone: diff <= 30 ? '🚨' : '📅',
                        titulo: diff === 0 ? `AGORA: ${pacMap[a.pacienteId] || 'Paciente'}`
                                           : `Em ${diff} min: ${pacMap[a.pacienteId] || 'Paciente'}`,
                        descricao: `Hoje às ${a.hora} — ${a.status}`,
                        tela: 'agendamentos', nivel: diff <= 30 ? 'urgente' : 'aviso'
                    });
                }
            });

        const naoConf = agendamentos.filter(a => a.data === hojeS && a.status === 'agendado');
        if (naoConf.length > 0) {
            notifs.push({ tipo: 'pendente', icone: '📋',
                titulo: `${naoConf.length} agendamento(s) hoje sem confirmar`,
                descricao: 'Ligue para os pacientes',
                tela: 'agendamentos', nivel: 'aviso' });
        }

        const pagPend = pagamentos.filter(p => p.status === 'pendente');
        if (pagPend.length > 0) {
            const total = pagPend.reduce((s, p) => s + Number(p.valor || 0), 0);
            notifs.push({ tipo: 'financeiro', icone: '💰',
                titulo: `${pagPend.length} pagamento(s) pendente(s)`,
                descricao: `Total a receber: ${formatarMoeda(total)}`,
                tela: 'financeiro', nivel: 'aviso' });
        }

        return notifs;
    }

    function renderNotificacoes() {
        const notifs = calcularNotificacoes();
        const badge = $('notifBadge');
        const lista = $('notifLista');
        const banner = $('bannerNotif');
        const bannerMsg = $('bannerMsg');
        if (!badge) return;

        if (notifs.length > 0) {
            badge.textContent = notifs.length;
            badge.classList.add('ativo');
        } else {
            badge.classList.remove('ativo');
        }

        if (notifs.length === 0) {
            lista.innerHTML = `<div class="notif-vazio"><span class="emoji">✅</span>Tudo em ordem!<br>Nenhuma notificação no momento.</div>`;
        } else {
            lista.innerHTML = notifs.map(n => `
                <div class="notif-item" onclick="irParaTela('${n.tela}')">
                    <span class="icone">${n.icone}</span>
                    <div class="texto">
                        <strong>${n.titulo}</strong>
                        <span>${n.descricao}</span>
                    </div>
                </div>
            `).join('');
        }

        const urgentes = notifs.filter(n => n.nivel === 'urgente');
        const bannerFechado = sessionStorage.getItem('bannerFechado') === 'true';
        if (urgentes.length > 0 && !bannerFechado) {
            bannerMsg.textContent = urgentes.length === 1
                ? urgentes[0].titulo
                : `⚠️ ${urgentes.length} alertas importantes (estoque/agenda)`;
            banner.classList.add('ativo');
        } else {
            banner.classList.remove('ativo');
        }
    }

    window.irParaTela = (nomeTela) => {
        const link = document.querySelector(`#menu a[data-tela="${nomeTela}"]`);
        if (link) { link.click(); $('notifPainel').classList.remove('ativo'); }
    };

    $('btnNotif').addEventListener('click', (e) => {
        e.stopPropagation();
        $('notifPainel').classList.toggle('ativo');
    });
    document.addEventListener('click', (e) => {
        const painel = $('notifPainel');
        const btn = $('btnNotif');
        if (painel && !painel.contains(e.target) && !btn.contains(e.target)) {
            painel.classList.remove('ativo');
        }
    });
    $('bannerFechar').addEventListener('click', () => {
        $('bannerNotif').classList.remove('ativo');
        sessionStorage.setItem('bannerFechado', 'true');
    });
    $('btnMarcarLidas').addEventListener('click', () => {
        $('notifPainel').classList.remove('ativo');
        sessionStorage.setItem('bannerFechado', 'true');
        $('bannerNotif').classList.remove('ativo');
    });

    /* ATUALIZA GERAL */
    function atualizarTudo() {
        preencherSelects();
        preencherSelectItens();
        preencherSelectFornecedores();
        preencherSelectAgendamentosPag();
        renderPacientes();
        renderProfissionais();
        renderServicos();
        renderEstoque();
        renderMovimentacoes();
        renderFornecedores();
        renderAgendamentos();
        renderPagamentos();
        renderHorarios();
        renderDashboard();
        renderUsuarios();
        renderLogs();
        renderRelatorios();
        renderNotificacoes();
        atualizarRodape();
    }

    if ($('pagData')) $('pagData').value = hojeStr();

    atualizarTudo();
    setInterval(() => { renderNotificacoes(); }, 60000);
})();