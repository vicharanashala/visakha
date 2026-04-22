import { pipeline } from "@xenova/transformers";

let extractor: any = null;

// Singleton pattern to load the model only once
export async function getEmbedder() {
  if (!extractor) {
    console.log("Loading embedding model Xenova/all-MiniLM-L6-v2...");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true, // Use quantized weights for better performance locally
    });
    console.log("Embedding model loaded successfully.");
  }
  return extractor;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  
  // By default, feature-extraction outputs a tensor. We use pooling 'mean' and normalize
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  
  // Convert tensor to regular numeric array
  return Array.from(output.data);
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const embedder = await getEmbedder();
  const embeddings: number[][] = [];
  
  // Processing in batches of 5 to avoid overwhelming local memory
  for (let i = 0; i < texts.length; i += 5) {
     const batch = texts.slice(i, i + 5);
     const output = await embedder(batch, { pooling: 'mean', normalize: true });
     
     // Output data for batch is flattened if it's a 2D tensor, we need to chunk it back
     // The embedding size for all-MiniLM-L6-v2 is 384
     const dim = 384; 
     for (let j = 0; j < batch.length; j++) {
       const start = j * dim;
       const end = start + dim;
       embeddings.push(Array.from(output.data.slice(start, end)));
     }
  }

  return embeddings;
}
