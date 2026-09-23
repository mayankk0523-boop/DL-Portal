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
          error: "GEMINI_API_KEY is missing in Netlify."
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
      ? body.history.slice(-10)
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

    // Models to try
    const models = [
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite"
    ];

    let lastError = "Gemini is temporarily unavailable.";

    for (const model of models) {

      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) +
        ":generateContent";

      // Try each model up to 2 times
      for (let attempt = 1; attempt <= 2; attempt++) {

        try {

          const response = await fetch(url, {
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

          const data = await response.json();

          // Successful response
          if (response.ok) {

            const reply =
              data?.candidates?.[0]?.content?.parts
                ?.map(function (part) {
                  return part.text || "";
                })
                .join("")
                .trim();

            if (reply) {
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                  reply: reply
                })
              };
            }

            lastError = "Gemini returned an empty response.";

          } else {

            lastError =
              data?.error?.message ||
              "Gemini API request failed.";

            // Temporary errors → retry
            if (
              response.status === 429 ||
              response.status === 500 ||
              response.status === 503 ||
              response.status === 504
            ) {

              if (attempt < 2) {
                await new Promise(function (resolve) {
                  setTimeout(resolve, 1500);
                });

                continue;
              }

              // Try next model
              break;

            } else {

              // Non-temporary error
              return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({
                  error: lastError
                })
              };
            }
          }

        } catch (error) {

          lastError =
            error.message ||
            "Unable to contact Gemini.";

          if (attempt < 2) {
            await new Promise(function (resolve) {
              setTimeout(resolve, 1500);
            });

            continue;
          }

          break;
        }
      }
    }

    // Both models failed
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error:
          "Gemini is temporarily busy. Please try again in a few seconds.",
        details: lastError
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          error.message ||
          "Server error while contacting Gemini."
      })
    };
  }
};
