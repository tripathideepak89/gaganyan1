interface Env {
  API_KEY: string;
}

type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}) => Promise<Response>;

export const onRequest: PagesFunction<Env> = async ({ env }) => {
  const apiKey = env.API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API_KEY is not configured on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ apiKey }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
