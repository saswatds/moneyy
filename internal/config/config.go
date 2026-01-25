package config

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server    ServerConfig              `mapstructure:"server"`
	Databases map[string]DatabaseConfig `mapstructure:"databases"`
	Secrets   SecretsConfig             `mapstructure:"secrets"`
	Logging   LoggingConfig             `mapstructure:"logging"`
	CORS      CORSConfig                `mapstructure:"cors"`
}

type ServerConfig struct {
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
}

type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	Name            string        `mapstructure:"name"`
	User            string        `mapstructure:"user"`
	PasswordEnv     string        `mapstructure:"password_env"`
	Password        string        // Populated from environment
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
}

type SecretsConfig struct {
	EncryptionMasterKeyEnv string `mapstructure:"encryption_master_key_env"`
	EncryptionMasterKey    string // Populated from environment
}

type LoggingConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

type CORSConfig struct {
	AllowedOrigins []string `mapstructure:"allowed_origins"`
	AllowedMethods []string `mapstructure:"allowed_methods"`
}

// Load loads configuration from config.yaml and environment variables
func Load() (*Config, error) {
	v := viper.New()

	// Set config file
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./")

	// Load .env file if it exists
	if _, err := os.Stat(".env"); err == nil {
		v.SetConfigFile(".env")
		if err := v.ReadInConfig(); err == nil {
			// Bind env vars from .env file
			for _, key := range v.AllKeys() {
				val := v.GetString(key)
				if val != "" {
					os.Setenv(key, val)
				}
			}
		}
	}

	// Reset to read config.yaml
	v.SetConfigName("config")
	v.SetConfigType("yaml")

	// Read configuration
	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Allow environment variables to override
	v.AutomaticEnv()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Populate passwords and secrets from environment variables
	for name, dbCfg := range cfg.Databases {
		if dbCfg.PasswordEnv != "" {
			password := os.Getenv(dbCfg.PasswordEnv)
			if password == "" {
				return nil, fmt.Errorf("environment variable %s not set for database %s", dbCfg.PasswordEnv, name)
			}
			dbCfg.Password = password
			cfg.Databases[name] = dbCfg
		}
	}

	if cfg.Secrets.EncryptionMasterKeyEnv != "" {
		key := os.Getenv(cfg.Secrets.EncryptionMasterKeyEnv)
		if key == "" {
			return nil, fmt.Errorf("environment variable %s not set", cfg.Secrets.EncryptionMasterKeyEnv)
		}
		cfg.Secrets.EncryptionMasterKey = key
	}

	return &cfg, nil
}

// MustLoad loads configuration and panics on error
func MustLoad() *Config {
	cfg, err := Load()
	if err != nil {
		panic(fmt.Sprintf("failed to load config: %v", err))
	}
	return cfg
}
