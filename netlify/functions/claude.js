exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // If the message contains a URL to fetch, grab the page content first
    let messages = body.messages;
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (typeof lastMsg.content === 'string') {
        const urlMatch = lastMsg.content.match(/https?:\/\/[^\s]+/);
        if (urlMatch && lastMsg.content.includes('Extrais la recette depuis cette URL')) {
          try {
            const pageRes = await fetch(urlMatch[0], {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
            });
            const html = await pageRes.text();
            const text = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 8000);

            messages = messages.slice(0, -1).concat([{
              role: 'user',
              content: `Voici le contenu de la page de recette. Extrais la recette et réponds UNIQUEMENT avec ce JSON sans backticks ni texte autour: {"name":"...","time":"...","portions":"...","type":"Plat","season":"","ingredients":"1 ingrédient par ligne:\\n200g farine\\n3 oeufs\\n...","steps":"1 étape par ligne sans numérotation:\\nFaire bouillir l'eau\\nAjouter le sel\\n...","notes":"","source":"${urlMatch[0]}"}\n\nContenu de la page:\n${text}`
            }]);
          } catch(fetchErr) {
            console.warn('Could not fetch URL:', fetchErr.message);
          }
        }
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ ...body, messages })
    });

    const data = await response.json();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
