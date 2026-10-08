// Copie para config.js e preencha (NÃO commitar config.js com valores reais).
//   cp painel/config.example.js painel/config.js
// O setup (node setup/marca.mjs, ou o wizard setup/configure.mjs) preenche o bloco MARCA por você.
window.APP_CONFIG = {
  WORKER_URL:   "https://corretor-zx-control.SEU-USUARIO.workers.dev",
  BEARER_TOKEN: "seu-panel-token-aqui",   // mesmo valor de PANEL_TOKEN no .env

  // Marca do cliente final: é o que aparece no painel (cor, nome e logo).
  MARCA: {
    nome: "Nome do corretor",
    cor_primaria: "#D97706",   // #RRGGBB. Este é o âmbar padrão ZX: troque pela cor da marca do cliente
    cor_secundaria: "",        // opcional, #RRGGBB. Vazio = derivada da primária
    logo: "",                  // opcional: "assets/logo.png" (copiado pelo setup) ou URL https. Vazio = só o nome
  },
};
