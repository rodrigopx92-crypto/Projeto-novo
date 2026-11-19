# 🏥 Clínica Bem-Estar — Sistema de Gestão Clínica

Este é o projeto integrador desenvolvido para a disciplina de Laboratório de Banco de Dados. O sistema consiste em uma aplicação web completa para a gestão de uma clínica médica, permitindo o controle de pacientes, profissionais, agendamentos, estoque e financeiro.

O projeto foi construído com foco em usabilidade, design moderno e integração real com banco de dados na nuvem.

---

## 🚀 Tecnologias Utilizadas

O projeto foi desenvolvido utilizando as seguintes tecnologias:

*   **Frontend:** HTML5, CSS3 (com design responsivo e moderno) e JavaScript (Vanilla JS).
*   **Banco de Dados:** Google Firebase (Firestore) — Banco de dados NoSQL em tempo real na nuvem.
*   **Autenticação:** Hash de senha PBKDF2 via Web Crypto API no lado do cliente.
*   **Hospedagem:** Firebase Hosting.

---

## ✨ Principais Funcionalidades

O sistema é dividido em módulos acessíveis através de um menu lateral e conta com controle de permissões (perfis de Administrador, Recepção e Profissional).

*   **Dashboard Dinâmico:** Visão geral com faturamento, agendamentos do dia, alertas de estoque e movimentações.
*   **Agendamentos:** Criação e gestão de consultas com filtros avançados (data, paciente, status).
*   **Pacientes e Profissionais:** Cadastro completo com CRUD (Criar, Ler, Atualizar, Excluir).
*   **Serviços:** Gestão de procedimentos e valores praticados pela clínica.
*   **Controle de Estoque:** Cadastro de insumos, alertas de estoque baixo e itens vencendo.
*   **Movimentações:** Registro de entrada e saída de estoque com atualização automática da quantidade em tempo real.
*   **Financeiro:** Registro de pagamentos, controle de valores pendentes e cálculo automático de ticket médio.
*   **Relatórios:** Análise de faturamento, taxa de comparecimento e ranking de serviços e profissionais mais produtivos.
*   **Log de Atividades:** Auditoria de todas as ações realizadas no sistema.
*   **Gerador de Dados de Teste:** Botão exclusivo no Dashboard que cria uma massa de dados realista (agendamentos, pagamentos e movimentações) para fins de demonstração e testes.

---

## 🔒 Segurança e Autenticação

*   As senhas dos usuários não são salvas em texto puro. Foi implementado um sistema de *hash* (criptografia) utilizando o algoritmo **PBKDF2** com *salt* aleatório.
*   O controle de sessão é feito via `localStorage` com tempo de expiração configurado.
*   O sistema conta com um controle básico de permissões de tela baseado no perfil do usuário logado (Admin, Recepção ou Profissional).

---

## 🌐 Como Acessar o Sistema

O sistema está hospedado e pode ser acessado diretamente pelo link abaixo:

👉 **[https://intense-pointer-244217.web.app](https://intense-pointer-244217.web.app)**

### Contas de Teste

Para avaliar o sistema, utilize uma das contas abaixo na tela de login:

| Perfil | E-mail | Senha |
| :--- | :--- | :--- |
| **Administrador** | `admin@clinica.com` | `admin123` |
| **Recepção** | `recepcao@clinica.com` | `recepcao123` |
| **Profissional** | `ana.souza@clinica.com` | `prof123` |

*(Nota: As contas de Recepção e Profissional foram criadas por padrão para testar as permissões do sistema. Caso não funcionem, a conta de Administrador tem acesso total).*

---

## 💻 Como Rodar o Projeto Localmente

Se desejar executar o projeto na sua máquina:

1. Clone este repositório.
2. Abra a pasta no Visual Studio Code.
3. Utilize a extensão **Live Server** (ou qualquer outro servidor local) para abrir o arquivo `index.html`.
4. O sistema já se conectará automaticamente ao banco de dados na nuvem.
5. *(Opcional)* Para testar o deploy localmente, certifique-se de ter o Firebase CLI instalado e rode `firebase serve`.

---

## 👨‍💻 Autores

Desenvolvido por **Rodrigo** e **Maisa** para o Projeto Integrador — **Fatec Americana**.

---
*Este projeto foi desenvolvido para fins acadêmicos.*
