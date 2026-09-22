import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Selorg API',
      version: process.env.API_VERSION || '1.0.0',
      description: 'Selorg quick-commerce platform API documentation',
      contact: { name: 'API Support', email: 'support@selorg.com' },
      license: { name: 'ISC' },
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 3333}`, description: 'Development server' },
      { url: 'https://api.selorg.com', description: 'Production server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'integer' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
