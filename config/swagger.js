import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Hotel API",
    version: "1.0.0",
    description: "API documentation for Hotel Booking System",
  },
  servers: [
    {
      url: "https://hotel-booking-api-y8gp.onrender.com",
      description: "Production server",
    },
  ],

  /* 🔐 ADD THIS PART (JWT CONFIG) */
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "https",
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
