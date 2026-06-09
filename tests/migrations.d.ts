// Permite importar o SQL da migration como string crua no teste (transform `?raw` do Vite).
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
