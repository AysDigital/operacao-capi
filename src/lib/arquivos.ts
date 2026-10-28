import { useEffect, useState } from 'react'
import { ops, supabase } from './supabase'

/**
 * Imagens da operação no Supabase Storage (bucket privado "operacao", migration 005).
 * Ficam em cards/{id do card}/..., e no banco são guardadas como "storage:{caminho}":
 *   - no texto (comentário, descrição): ![imagem](storage:cards/…/x.png)
 *   - em anexos.url: storage:cards/…/x.png
 */
const BUCKET = 'operacao'
export const PREFIXO = 'storage:'
const TIPOS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const LIMITE = 10 * 1024 * 1024

export const ehArquivo = (url: string) => url.startsWith(PREFIXO)
export const caminhoDe = (url: string) => url.slice(PREFIXO.length)
export const marcaImagem = (caminho: string) => `![imagem](${PREFIXO}${caminho})`

/** Caminhos das imagens citadas num texto (para apagar junto). */
export const caminhosNoTexto = (texto: string) => [...texto.matchAll(/!\[[^\]]*\]\(storage:([^)\s]+)\)/g)].map((m) => m[1])

/** Imagens de uma colagem ou de um arrastar. */
export function imagensDe(dados: DataTransfer | null): File[] {
  return [...(dados?.files ?? [])].filter((f) => TIPOS.includes(f.type))
}

/** Envia a imagem para a pasta do card. Devolve o caminho ou lança um erro em português. */
export async function enviarImagem(cardId: string, arquivo: File): Promise<string> {
  if (!TIPOS.includes(arquivo.type)) throw new Error('Só dá para enviar imagens (PNG, JPG, GIF ou WEBP).')
  if (arquivo.size > LIMITE) throw new Error('A imagem passa de 10 MB.')
  const ext = arquivo.type.split('/')[1].replace('jpeg', 'jpg')
  const caminho = `cards/${cardId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type })
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`)
  return caminho
}

export async function removerArquivos(caminhos: string[]) {
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos)
}

/** Apaga todas as imagens do card (antes de excluir o card). */
export async function limparPastaDoCard(cardId: string) {
  const pasta = `cards/${cardId}`
  const { data } = await supabase.storage.from(BUCKET).list(pasta, { limit: 1000 })
  await removerArquivos((data ?? []).map((f) => `${pasta}/${f.name}`))
}

// Links temporários (o bucket é privado): guardados por 50 min, valem 1 h.
const cache = new Map<string, { url: string; ate: number }>()

export async function urlAssinada(caminho: string): Promise<string | null> {
  const guardado = cache.get(caminho)
  if (guardado && guardado.ate > Date.now()) return guardado.url
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600)
  if (!data) return null
  cache.set(caminho, { url: data.signedUrl, ate: Date.now() + 50 * 60_000 })
  return data.signedUrl
}

export function useUrlAssinada(caminho: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    if (caminho) urlAssinada(caminho).then((u) => vivo && setUrl(u))
    return () => {
      vivo = false
    }
  }, [caminho])
  return url
}

/** O arquivo está na pasta deste card? (só esses podem ser apagados junto com algo do card) */
export const ehDoCard = (cardId: string, caminho: string) => caminho.startsWith(`cards/${cardId}/`)

/**
 * Depois de criar versões ou duplicar: as imagens copiadas pelo banco ainda apontam
 * para a pasta da origem. Copia cada arquivo para a pasta do card novo e troca o caminho
 * (nos anexos e na descrição). Se a cópia de um arquivo falhar, ele continua apontando
 * para a origem, que segue funcionando.
 */
export async function copiarImagensParaCards(cardIds: string[]) {
  for (const cardId of cardIds) {
    const [{ data: anexos }, { data: card }] = await Promise.all([
      ops().from('anexos').select('id, url').eq('card_id', cardId).like('url', `${PREFIXO}%`),
      ops().from('cards').select('descricao').eq('id', cardId).maybeSingle(),
    ])
    const novos = new Map<string, string>()
    const copiar = async (caminho: string) => {
      if (ehDoCard(cardId, caminho)) return caminho
      if (!novos.has(caminho)) {
        const destino = `cards/${cardId}/${crypto.randomUUID()}.${caminho.split('.').pop()}`
        const { error } = await supabase.storage.from(BUCKET).copy(caminho, destino)
        novos.set(caminho, error ? caminho : destino)
      }
      return novos.get(caminho)!
    }
    for (const a of anexos ?? []) {
      const destino = await copiar(caminhoDe(a.url))
      if (destino !== caminhoDe(a.url)) await ops().from('anexos').update({ url: PREFIXO + destino }).eq('id', a.id)
    }
    const descricao = card?.descricao ?? ''
    const caminhos = caminhosNoTexto(descricao)
    if (caminhos.length) {
      let texto = descricao
      for (const c of caminhos) texto = texto.split(`${PREFIXO}${c}`).join(`${PREFIXO}${await copiar(c)}`)
      if (texto !== descricao) await ops().from('cards').update({ descricao: texto }).eq('id', cardId)
    }
  }
}
