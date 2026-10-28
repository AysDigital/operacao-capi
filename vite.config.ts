import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Em `npm run dev`, atende /api/<nome> chamando a função de api/<nome>.ts,
 * do mesmo jeito que o Vercel faz em produção (handler POST/GET com Request/Response).
 * Assim não é preciso `vercel dev` para testar localmente.
 */
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const nome = req.url.slice('/api/'.length).split('?')[0]
        try {
          const modulo = await server.ssrLoadModule(`/api/${nome}.ts`)
          const handler = modulo[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const partes: Buffer[] = []
          for await (const parte of req) partes.push(parte as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v)
            else if (Array.isArray(v)) headers.set(k, v.join(', '))
          }
          const temCorpo = !['GET', 'HEAD'].includes(req.method ?? 'GET')
          const resposta = await handler(
            new Request(`http://localhost${req.url}`, {
              method: req.method,
              headers,
              body: temCorpo ? Buffer.concat(partes) : undefined,
            }),
          )
          res.statusCode = resposta.status
          resposta.headers.forEach((valor, chave) => res.setHeader(chave, valor))
          res.end(Buffer.from(await resposta.arrayBuffer()))
        } catch (e) {
          console.error(e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ erro: String(e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Variáveis do .env.local (inclusive META_ADS_TOKEN) para as funções api/ no
  // servidor local. Só as VITE_* chegam ao navegador.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), tailwindcss(), apiLocal()],
  }
})
