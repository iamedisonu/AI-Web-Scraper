import selenium.webdriver as webdriver
from selenium.webdriver.edge.service import Service
from selenium.webdriver.edge.options import Options
import time

def scrape_website(website):
    print("Launnching Chrome browser...")
    
    chrome_driver_path ="./msedgedriver.exe"
    options = Options()
    driver = webdriver.Edge(service=Service(chrome_driver_path), options = options)
    
    try:
        driver.get(website)
        print("page loaded...")
        html = driver.page_source
        time.sleep(10)
        return html
    finally:
        driver.quit()