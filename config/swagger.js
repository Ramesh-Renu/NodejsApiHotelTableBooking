import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Hotel API",
    version: "1.0.0",
    description: "API documentation for Hotel Booking System",
  },
  // "/" = the server this page is opened from, so "Try it out" works both
  // locally (http://localhost:5000/api-docs) and on Render
  // (https://hotel-table-booking.onrender.com/api-docs).
  servers: [
    {
      url: "/",
      description: "This server",
    },
  ],

  /* 🔐 ADD THIS PART (JWT CONFIG) */
  components: {
    securitySchemes: {
      bearerAuth: {
        // OpenAPI's scheme type is "http" (bearer token), even over HTTPS.
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },

  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  definition: swaggerDefinition, // ✅ correct key
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
