export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // استقبال طلبات الدردشة من الواجهة
    if (url.pathname === "/api/chat" || (request.method === "POST" && !url.pathname.includes("."))) {
      
      const apiKey = env.GEMINI_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ reply: "الخدمة غير مفعّلة حالياً (مفتاح API غير مُعرّف)." }),
          { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } }
        );
      }

      try {
        const body = await request.json();
        const userPrompt = body.prompt || body.message || body.text;

        const aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userPrompt }] }]
            })
          }
        );

        const data = await aiResponse.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أستطع معالجة الإجابة.";

        return new Response(JSON.stringify({ reply: replyText }), {
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });

      } catch (err) {
        return new Response(
          JSON.stringify({ reply: "حدث خطأ أثناء الاتصال بالخادم." }),
          { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
        );
      }
    }

    // عرض ملفات الموقع الثابتة
    return env.ASSETS.fetch(request);
  }
};
