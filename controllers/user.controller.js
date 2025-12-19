import RegisterUsersData from "../models/user.model.js";

// REGISTER USER (OTP BASED)
export const registerUser = async (req, res) => {
  try {
    const { name, email, mobilenumber, location } = req.body;

    const existingUser = await RegisterUsersData.findOne({
      where: { mobilenumber },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already registered",
      });
    }

    const user = await RegisterUsersData.create({
      name,
      email,
      mobilenumber,
      location,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

