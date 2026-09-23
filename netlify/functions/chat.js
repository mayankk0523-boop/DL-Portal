exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "Method not allowed"
      })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "GEMINI_API_KEY is not configured in Netlify."
        })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const message = String(body.message || "").trim();

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Message is required."
        })
      };
    }

    const history = Array.isArray(body.history)
      ? body.history.slice(-12)
      : [];

    const contents = [];

    for (const item of history) {
      if (!item || !item.role || !item.text) continue;

      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: String(item.text).slice(0, 4000)
          }
        ]
      });
    }

    contents.push({
      role: "user",
      parts: [
        {
          text: message.slice(0, 6000)
        }
      ]
    });

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent";

    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are DL Assistant, the AI assistant for the Digital Library Student Portal. " +
                "Be friendly, helpful and concise. Help students with the digital library, " +
                "notes, helpdesk, categories, complaints and general study questions."
            }
          ]
        },

        contents: contents,

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return {
        statusCode: geminiResponse.status,
        headers,
        body: JSON.stringify({
          error:
            data?.error?.message ||
            "Gemini API request failed."
        })
      };
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(function (part) {
          return part.text || "";
        })
        .join("")
        .trim();

    if (!reply) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Gemini returned no response."
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: reply
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Server error."
      })
    };
  }
};
