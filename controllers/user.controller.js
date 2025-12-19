import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { ValidationError } from 'sequelize'; // Add this line
// CREATE USER
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists by email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(200).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12); 

    // Create the user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      success: true,
      data: user,
      message: "User created successfully",
    });
  } catch (error) {
    // Handle Sequelize validation error (e.g., unique constraint violation)
    if (error instanceof ValidationError) {
      console.error('Validation error:', error);
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + error.errors.map(e => e.message).join(', '),
      });
    }

    // Log and return a generic server error
    console.error('Error creating user:', error); 
    res.status(500).json({
      success: false,
      message: "Server error", 
      error: error.message,  // Return the error message in response for debugging
    });
  }
};

// GET USERS
export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// LOGIN (POSTGRES + SEQUELIZE)
export const login = async (req, res) => {
  try {
    const { name, password } = req.body;
    // Find the user by email (using 'name' here as the email)
    const user = await User.findOne({
      where: { email: name },  // Searching by email, not 'name'
    });

    if (!user) {
      console.log("User not found");
      return res.status(200).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if the password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("Password mismatch");
      return res.status(200).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    console.log("Login successful!");
    res.json({
      success: true,
      message: "Login successful",
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

