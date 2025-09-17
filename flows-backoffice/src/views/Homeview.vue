<template>
  <main class="container">
    <h1>🏁 Benvenuto</h1>
    <p>Questa è la pagina principale del tuo progetto Vue.</p>

    <div class="cta">
      <a href="https://vuejs.org/guide/introduction.html" target="_blank" rel="noreferrer">Documentazione Vue</a>
      <a href="https://vitejs.dev/guide/" target="_blank" rel="noreferrer">Guida Vite</a>
    </div>
  </main>
</template>

<script setup>
// pagina minimale: nessuna logica necessaria
</script>

<style scoped>
.container {
  max-width: 760px;
  margin: 20vh auto 0;
  padding: 24px;
  text-align: center;
}
h1 {
  font-size: 2.4rem;
  line-height: 1.2;
  margin-bottom: 0.5rem;
}
p {
  color: #555;
  margin-bottom: 1.5rem;
}
.cta {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.cta a {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #e5e5e5;
  text-decoration: none;
}
.cta a:hover {
  border-color: #ccc;
}
</style>
