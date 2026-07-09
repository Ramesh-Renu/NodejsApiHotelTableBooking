import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "OTP Authentication API",
    version: "1.0.0",
    description: "API documentation for OTP-based authentication",
  },
  servers: [
    {
      url: "https://hotel-booking-api-y8gp.onrender.coms",
      description: "Local server",
    },
  ],

  /* 🔐 ADD THIS PART (JWT CONFIG) */
  components: {
    securitySchemes: {
      bearerAuth: {
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
