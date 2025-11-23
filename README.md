
# TravelBilli - AI-Powered Flight & Hotel Booking Assistant

TravelBilli is an intelligent, conversational travel assistant designed to simplify the process of finding and booking flights and hotels. It combines a user-friendly chat interface powered by Google's Gemini model with traditional search forms, providing a seamless and efficient trip planning experience.

## ✨ Features

- **Conversational Chat Interface:** Use natural language to search for flights and hotels. Just ask "Find me flights from SFO to JFK tomorrow" and TravelBilli will understand.
- **Multi-Provider Search:** Aggregates real-time data from multiple travel APIs (Amadeus and Duffel) to give you more options.
- **Smart Function Calling:** Leverages Gemini's function calling capabilities to intelligently parse user requests and fetch the correct data.
- **Structured Search Forms:** For users who prefer a traditional experience, dedicated and easy-to-use forms are available for flights and hotels.
- **Intelligent Sorting:** Flight and hotel results are scored and can be sorted by 'Best', 'Cheapest', and 'Fastest' to help you find the perfect option.
- **Automatic IATA Code Lookup:** No need to know airport codes. TravelBilli automatically looks up IATA codes for cities and airports you mention.
- **Detailed Results:** View flight segments, durations, stops, and hotel ratings in a clean, card-based UI.

## ⚙️ How It Works

1.  **User Interaction:** The user can either type a request into the chat or fill out the flight/hotel search forms.
2.  **AI Processing:** Chat messages are sent to the Google Gemini model. The model is configured with a system prompt and a set of available tools (`searchFlights`, `searchHotels`, `searchCityCode`).
3.  **Function Calling:** Gemini analyzes the user's request and determines which function(s) to call with the appropriate arguments. For example, "flights to Paris" will trigger a `searchCityCode` call for "Paris" first.
4.  **Secure API Proxy:** The function calls from the frontend are routed through a Cloudflare Worker. This worker acts as a secure proxy, injecting the necessary API keys for the Amadeus and Duffel APIs and managing authentication tokens. This ensures that no sensitive credentials are exposed on the client-side.
5.  **Data Aggregation & Scoring:** The app fetches data from multiple providers, deduplicates the results, and applies a scoring algorithm to rank flights (based on price, duration, stops) and hotels (based on price, rating).
6.  **Displaying Results:** The processed and sorted results are displayed to the user in the chat window as interactive cards.

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **AI Model:** Google Gemini API (`@google/genai`)
- **Backend Proxy:** Cloudflare Workers
- **Travel APIs:**
    - Amadeus Self-Service API
    - Duffel API

## 🔐 Supabase Authentication Setup

To ensure the sign-up confirmation links redirect correctly to your deployed application:

1.  Go to your **Supabase Dashboard**.
2.  Navigate to **Authentication** > **URL Configuration**.
3.  Under **Redirect URLs**, add your production URL (e.g., `https://travelbilli.com` or `https://your-project.pages.dev`).
4.  Ensure the **Site URL** is also set correctly.

> **Note:** If the redirect URL sent by the app (e.g., `https://travelbilli.com`) is not in this allowed list, Supabase will ignore it and fall back to the default Site URL (often `localhost:3000`), causing the email link to point to localhost.

## 🛠️ Setup & Configuration

This project is designed to be deployed on a serverless platform like Cloudflare Pages, which natively supports integrating serverless functions (Workers) with a static frontend.

### Environment Variables

To run this application, you will need to configure the following environment variables in your deployment environment:

- **`API_KEY`**: Your API key for the Google Gemini API.
- **`AMADEUS_API_KEY`**: Your client ID from the Amadeus for Developers portal.
- **`AMADEUS_API_SECRET`**: Your client secret from the Amadeus for Developers portal.
- **`DUFFEL_API_KEY`**: Your access token from the Duffel dashboard.
- **`VITE_SITE_URL`** (Optional): Force the authentication redirect URL to a specific domain (e.g., `https://travelbilli.com`).

The Cloudflare Worker located in `/functions/api/[[path]].ts` is pre-configured to use these variables to securely proxy requests to the respective third-party APIs.