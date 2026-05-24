-- RDMS Database Schema
-- Umeed-e-Sahar Foundation
CREATE DATABASE umeed_e_sahar;
USE umeed_e_sahar;
CREATE TABLE Users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('NGO Admin','Field Worker','Finance Officer','Auditor'),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE Location (
    location_id INT PRIMARY KEY AUTO_INCREMENT,
    village_name VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    population INT
);
CREATE TABLE Donor (
    donor_id INT PRIMARY KEY AUTO_INCREMENT,
    donor_name VARCHAR(100) NOT NULL,
    contact VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    country VARCHAR(50) NOT NULL DEFAULT 'Pakistan'
);
CREATE TABLE Donation (
    donation_id INT PRIMARY KEY AUTO_INCREMENT,
    donor_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    donation_date DATE NOT NULL,
    type VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    FOREIGN KEY (donor_id) REFERENCES Donor(donor_id)
);
CREATE TABLE Project (
    project_id INT PRIMARY KEY AUTO_INCREMENT,
    location_id INT NOT NULL,
    project_name VARCHAR(150) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    budget DECIMAL(15,2),
    budget_used DECIMAL(15,2),
    status VARCHAR(50) NOT NULL,
    FOREIGN KEY (location_id) REFERENCES Location(location_id)
);
CREATE TABLE Donation_Allocation (
    allocation_id INT PRIMARY KEY AUTO_INCREMENT,
    donation_id INT NOT NULL,
    project_id INT NOT NULL,
    allocated_amount DECIMAL(15,2) NOT NULL,
    allocation_date DATE NOT NULL,
    purpose TEXT,
    FOREIGN KEY (donation_id) REFERENCES Donation(donation_id),
    FOREIGN KEY (project_id) REFERENCES Project(project_id)
);
CREATE TABLE Beneficiary (
    beneficiary_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    cnic VARCHAR(15) NOT NULL UNIQUE,
    age INT,
    household_size INT NOT NULL,
    income_source VARCHAR(100),
    location_id INT NOT NULL,
    needs TEXT,
    status VARCHAR(50) NOT NULL,
    FOREIGN KEY (location_id) REFERENCES Location(location_id)
);
CREATE TABLE Inventory (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    FOREIGN KEY (project_id) REFERENCES Project(project_id)
);
CREATE TABLE Aid_Distribution (
    distribution_id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    beneficiary_id INT NOT NULL,
    item_id INT NOT NULL,
    distribution_date DATE NOT NULL,
    quantity_given INT NOT NULL,
    notes TEXT,
    FOREIGN KEY (project_id) REFERENCES Project(project_id),
    FOREIGN KEY (beneficiary_id) REFERENCES Beneficiary(beneficiary_id),
    FOREIGN KEY (item_id) REFERENCES Inventory(item_id)
);
CREATE TABLE Volunteer (
    volunteer_id INT PRIMARY KEY AUTO_INCREMENT,
    volunteer_name VARCHAR(100) NOT NULL,
    contact VARCHAR(50) NOT NULL,
    skills TEXT,
    availability VARCHAR(50) NOT NULL,
    location_id INT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES Location(location_id)
);
CREATE TABLE Project_Volunteer (
    proj_vol_id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    volunteer_id INT NOT NULL,
    role VARCHAR(100),
    FOREIGN KEY (project_id) REFERENCES Project(project_id),
    FOREIGN KEY (volunteer_id) REFERENCES Volunteer(volunteer_id)
);
